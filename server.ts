import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import ffmpeg from 'fluent-ffmpeg';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { PassThrough } from 'stream';
import axios from 'axios';
import unzipper from 'unzipper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes || bytes <= 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[Math.min(i, sizes.length - 1)]}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Set custom FFmpeg path if specified in environment
  if (process.env.FFMPEG_PATH) {
    try {
      ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
      console.log(`Using custom FFmpeg at: ${process.env.FFMPEG_PATH}`);
    } catch (e) {
      console.warn('Failed to set custom FFMPEG_PATH:', e);
    }
  }

  // CORS middleware: Allows cross-origin requests from Vercel frontend or custom domain
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoint (used by Vercel frontend to wake up Render free tier and for uptime monitors)
  app.get(['/health', '/api/health'], (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      service: 'MZ Drive Utilities Backend',
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  });

  // 1. API: Check remote file size and mimeType (FIDU core feature)
  app.post('/api/check-file', async (req, res) => {
    const { fileUrl } = req.body;
    if (!fileUrl) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    try {
      let headRes: any;
      try {
        headRes = await axios.head(fileUrl, { timeout: 12000, maxRedirects: 5 });
      } catch (headErr) {
        // Fallback: Range request for servers that block HEAD
        headRes = await axios.get(fileUrl, {
          headers: { Range: 'bytes=0-0' },
          timeout: 12000,
          maxRedirects: 5,
        });
      }

      const mimeType = headRes.headers['content-type'] || 'application/octet-stream';
      let size = headRes.headers['content-length'] || null;
      if (!size && headRes.headers['content-range']) {
        const match = headRes.headers['content-range'].match(/\/(\d+)/);
        if (match) size = match[1];
      }

      return res.json({ success: true, mimeType, size });
    } catch (err: any) {
      console.error('Check file error:', err.message);
      return res.status(500).json({ success: false, error: err.message || 'Failed to inspect remote file' });
    }
  });

  // 2. API: Create folder in Google Drive (FIDU core feature)
  app.post('/api/create-folder', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { folderName } = req.body;

    if (!token || !folderName) {
      return res.status(400).json({ success: false, error: 'Token and folder name required' });
    }

    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: token });
      const drive = google.drive({ version: 'v3', auth });

      const response = await drive.files.create({
        requestBody: {
          name: folderName.trim(),
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id, name',
        supportsAllDrives: true,
      });

      return res.json({ success: true, folder: response.data });
    } catch (err: any) {
      console.error('Create folder error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to create folder' });
    }
  });

  // 3. API: Remote URL stream direct to Google Drive (FIDU core feature)
  app.post('/api/upload-stream', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { fileUrl, folderId, fileName: customFileName } = req.body;

    if (!token || !fileUrl) {
      return res.status(400).json({ type: 'error', message: 'Token and fileUrl are required' });
    }

    // Set chunked text/plain streaming response for NDJSON
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const sendEvent = (data: any) => {
      try {
        res.write(JSON.stringify(data) + '\n');
      } catch (e) {
        console.error('Stream write error:', e);
      }
    };

    try {
      sendEvent({ type: 'status', message: 'Connecting to remote server...' });

      const remoteRes = await axios.get(fileUrl, {
        responseType: 'stream',
        timeout: 45000,
        maxRedirects: 5,
      });

      const totalBytes = parseInt(String(remoteRes.headers['content-length'] || '0'), 10);
      const contentType = String(remoteRes.headers['content-type'] || 'application/octet-stream');

      let fileName = customFileName ? customFileName.trim() : null;
      if (!fileName) {
        try {
          const parsed = new URL(fileUrl);
          const base = path.basename(parsed.pathname);
          fileName = base ? decodeURIComponent(base) : `file_${Date.now()}`;
        } catch {
          fileName = `file_${Date.now()}`;
        }
      }

      sendEvent({
        type: 'status',
        message: `Streaming "${fileName}" (${totalBytes > 0 ? formatBytes(totalBytes) : 'live stream'}) to Drive...`,
      });

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: token });
      const drive = google.drive({ version: 'v3', auth });

      let uploadedBytes = 0;
      let lastReportTime = 0;
      const progressPass = new PassThrough();

      remoteRes.data.on('data', (chunk: Buffer) => {
        uploadedBytes += chunk.length;
        const now = Date.now();
        if (now - lastReportTime > 250 || uploadedBytes === totalBytes) {
          lastReportTime = now;
          const percent = totalBytes > 0 ? Math.min(100, Math.round((uploadedBytes / totalBytes) * 100)) : undefined;
          sendEvent({ type: 'progress', percent, bytes: uploadedBytes, total: totalBytes || uploadedBytes });
        }
      });

      remoteRes.data.on('error', (err: any) => {
        console.error('Remote download stream error:', err);
        sendEvent({ type: 'error', message: `Download interrupted: ${err.message}` });
        progressPass.destroy(err);
      });

      remoteRes.data.pipe(progressPass);

      const parents = folderId && folderId !== 'root' && folderId !== 'new' ? [folderId] : undefined;

      const uploadRes: any = await (drive.files.create as any)({
        requestBody: {
          name: fileName,
          mimeType: contentType,
          parents,
        },
        media: {
          mimeType: contentType,
          body: progressPass,
        },
        fields: 'id, name, webViewLink, size',
        supportsAllDrives: true,
      });

      sendEvent({
        type: 'success',
        file: uploadRes.data,
        message: `Saved "${uploadRes.data.name}" successfully!`,
      });

      res.end();
    } catch (err: any) {
      console.error('Upload stream error:', err.message);
      sendEvent({ type: 'error', message: err.message || 'Upload failed' });
      res.end();
    }
  });

  // API: Remote ZIP stream extract and upload direct to Google Drive (FIDU core feature)
  app.post('/api/upload-zip-stream', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { fileUrl, folderId } = req.body;

    if (!token || !fileUrl) {
      return res.status(400).json({ type: 'error', message: 'Token and fileUrl are required' });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const sendEvent = (data: any) => {
      try {
        res.write(JSON.stringify(data) + '\n');
      } catch (e) {
        console.error('Stream write error:', e);
      }
    };

    try {
      sendEvent({ type: 'status', message: 'Connecting to remote ZIP archive...' });

      const remoteRes = await axios.get(fileUrl, {
        responseType: 'stream',
        timeout: 60000,
        maxRedirects: 5,
      });

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: token });
      const drive = google.drive({ version: 'v3', auth });

      sendEvent({ type: 'status', message: 'Extracting and uploading ZIP contents to Drive...' });

      const folderMap = new Map<string, string>();
      const rootFolderId = folderId && folderId !== 'root' && folderId !== 'new' ? folderId : undefined;
      let totalExtracted = 0;

      const getOrCreateDriveFolder = async (dirPath: string): Promise<string | undefined> => {
        if (!dirPath || dirPath === '.' || dirPath === '/') return rootFolderId;
        const normalized = path.normalize(dirPath).replace(/^(\/|\\)+|(\/|\\)+$/g, '');
        if (folderMap.has(normalized)) return folderMap.get(normalized);

        const parts = normalized.split(/[\/\\]+/);
        let currentParent = rootFolderId;
        let cumulativePath = '';

        for (const part of parts) {
          cumulativePath = cumulativePath ? `${cumulativePath}/${part}` : part;
          if (folderMap.has(cumulativePath)) {
            currentParent = folderMap.get(cumulativePath);
            continue;
          }

          const createdFolder = await drive.files.create({
            requestBody: {
              name: part,
              mimeType: 'application/vnd.google-apps.folder',
              parents: currentParent ? [currentParent] : undefined,
            },
            fields: 'id',
            supportsAllDrives: true,
          });
          const newId = createdFolder.data.id || '';
          folderMap.set(cumulativePath, newId);
          currentParent = newId;
        }

        return currentParent;
      };

      const zipStream = remoteRes.data.pipe(unzipper.Parse({ verbose: false }));

      for await (const entry of zipStream) {
        const entryPath = entry.path;
        const type = entry.type; // 'Directory' or 'File'

        if (type === 'Directory') {
          await getOrCreateDriveFolder(entryPath);
          entry.autodrain();
        } else {
          const dirName = path.dirname(entryPath);
          const parentId = await getOrCreateDriveFolder(dirName);
          const fileName = path.basename(entryPath);

          sendEvent({ type: 'status', message: `Uploading "${fileName}" to Drive...` });

          await drive.files.create({
            requestBody: {
              name: fileName,
              parents: parentId ? [parentId] : undefined,
            },
            media: {
              body: entry,
            },
            fields: 'id, name',
            supportsAllDrives: true,
          });

          totalExtracted++;
          sendEvent({
            type: 'status',
            message: `[${totalExtracted}] Saved "${fileName}" to Drive`,
          });
        }
      }

      sendEvent({
        type: 'success',
        isZip: true,
        message: `Extracted and uploaded ${totalExtracted} file(s) successfully!`,
      });
      res.end();
    } catch (err: any) {
      console.error('ZIP extraction error:', err);
      sendEvent({ type: 'error', message: err.message || 'ZIP extraction failed' });
      res.end();
    }
  });

  // 4. API: D-VAC Video to MP3 Conversion
  app.post('/api/convert', async (req, res) => {
    const { file_id, file_name, access_token } = req.body;
    const fileId = file_id || req.body.fileId;
    const fileName = file_name || req.body.fileName;
    const accessToken = access_token || req.body.accessToken;

    if (!fileId || !accessToken) {
      return res.status(400).json({ success: false, error: 'Missing fileId or accessToken' });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth });

    const jobId = uuidv4();
    console.log(`D-VAC: [Job ${jobId}] Starting stream conversion for ${fileName || fileId}`);

    let ffmpegCommand: any = null;

    // Cleanup FFmpeg process if client drops connection
    req.on('close', () => {
      if (ffmpegCommand && !res.writableEnded) {
        console.log(`D-VAC: [Job ${jobId}] Client connection closed. Terminating FFmpeg process.`);
        try {
          ffmpegCommand.kill('SIGKILL');
        } catch (e) {}
      }
    });

    try {
      const meta = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, parents',
        supportsAllDrives: true,
      });

      if (!meta.data.mimeType?.startsWith('video/')) {
        return res.status(400).json({
          success: false,
          error: `File is not a video (${meta.data.mimeType || 'unknown'}). Please select a video file.`
        });
      }

      const videoRes = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' }
      );

      const audioStream = new PassThrough();
      const baseName = (fileName || meta.data.name || 'audio').replace(/\.[^/.]+$/, "");
      const uploadName = `${baseName}.mp3`;

      // Save MP3 in the same parent folder as the original video if available
      const parents = meta.data.parents && meta.data.parents.length > 0 ? meta.data.parents : undefined;

      const uploadPromise = drive.files.create({
        requestBody: {
          name: uploadName,
          mimeType: 'audio/mpeg',
          parents,
        },
        media: {
          mimeType: 'audio/mpeg',
          body: audioStream,
        },
        fields: 'id, name, webViewLink, size',
        supportsAllDrives: true,
      });

      // Catch early upload errors to prevent UnhandledPromiseRejection
      let uploadError: any = null;
      uploadPromise.catch((err) => {
        uploadError = err;
      });

      await new Promise((resolve, reject) => {
        ffmpegCommand = ffmpeg(videoRes.data)
          .toFormat('mp3')
          .audioBitrate(192)
          .on('error', (err) => {
            console.error(`D-VAC: [Job ${jobId}] FFmpeg error:`, err.message);
            audioStream.destroy(err);
            reject(new Error(`FFmpeg conversion failed: ${err.message}`));
          })
          .on('end', () => {
            console.log(`D-VAC: [Job ${jobId}] FFmpeg finished.`);
            resolve(true);
          });

        ffmpegCommand.pipe(audioStream, { end: true });
      });

      if (uploadError) {
        throw uploadError;
      }

      const uploadRes = await uploadPromise;
      return res.json({
        success: true,
        fileId: uploadRes.data.id,
        link: uploadRes.data.webViewLink,
        name: uploadRes.data.name,
      });
    } catch (error: any) {
      console.error(`D-VAC: [Job ${jobId}] Failed:`, error);
      let detail = error.message || 'Internal server error';
      if (error.response?.data?.error) {
        detail = error.response.data.error.message || JSON.stringify(error.response.data.error);
      }
      return res.status(error.response?.status || 500).json({ success: false, error: detail });
    }
  });

  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RENDER;

  if (!isProduction) {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'custom',
      });

      app.use(vite.middlewares);

      app.use('*', async (req, res, next) => {
        const url = req.originalUrl;
        if (url.startsWith('/api') || url.startsWith('/health')) return next();

        try {
          let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e: any) {
          vite.ssrFixStacktrace(e);
          res.status(500).end(e.message);
        }
      });
    } catch (e) {
      console.warn('Vite dev server failed to start, falling back to static files:', e);
    }
  } else {
    // Production / Render Backend Mode
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res, next) => {
        if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/health')) return next();
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      app.get('/', (req, res) => {
        res.json({
          name: 'MZ Drive Utilities API',
          status: 'online',
          frontend: 'Hosted on Vercel',
          endpoints: [
            '/api/health',
            '/api/check-file',
            '/api/create-folder',
            '/api/upload-stream',
            '/api/upload-zip-stream',
            '/api/convert',
          ],
        });
      });
    }
  }

  const port = parseInt(process.env.PORT || '3000', 10);
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
  });

  server.timeout = 600000;
}

startServer();
