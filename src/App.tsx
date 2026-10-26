import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { initAuth, googleSignIn, signInWithGis, logout, AppUser } from './lib/firebase';
import { loadGoogleApi, openPicker } from './lib/google-picker';
import { 
  Music, 
  Video, 
  Cloud, 
  CheckCircle, 
  Loader2, 
  LogOut, 
  ExternalLink, 
  Upload, 
  ArrowLeft, 
  FileUp, 
  FileAudio, 
  Moon, 
  Sun, 
  ChevronRight, 
  AlertCircle, 
  FolderPlus,
  Folder
} from 'lucide-react';
import { motion } from 'motion/react';

export const BACKEND_URL = (
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_BACKEND_URL || import.meta.env?.VITE_RENDER_BACKEND_URL)) ||
  ''
).replace(/\/$/, '') || 'https://drive-video-to-audio-converter.onrender.com';

export const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  // In local dev environment with server.ts, relative path routes to local server
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return cleanEndpoint;
  }
  return `${BACKEND_URL}${cleanEndpoint}`;
};

type Language = 'en' | 'ur';
type Theme = 'light' | 'dark';

// --- Format Bytes Helper ---
function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// --- i18n Dictionary matching original FIDU ---
const i18n = {
  en: {
    appTitle: "File In Drive Upload",
    appDesc: "File In Drive Upload is a web application that allows users to easily select and upload their files directly to their personal Google Drive account through secure Google OAuth authentication.",
    hubTitle: "MZ Drive Utilities",
    hubDesc: "A unified suite of specialized cloud utilities for your Google Drive.",
    loginTitle: "MZ Drive Utilities",
    loginSubtitle: "Google Drive Cloud Tools Suite",
    loginDesc: "MZ Drive Utilities is an all-in-one suite connecting you directly to Google Drive. Upload web files & ZIP archives effortlessly, or convert Drive videos to high-quality 192kbps MP3 audio with one secure Google login.",
    feature1Title: "File In Drive Upload",
    feature1Desc: "Direct URL & local file uploader with ZIP extraction directly into your Google Drive.",
    feature2Title: "Drive Video to Audio (D-VAC)",
    feature2Desc: "Convert Google Drive videos to high-quality 192kbps MP3 audio via cloud FFmpeg.",
    loginText: "Please log in with your Google account first:",
    loginBtn: "Login with Google",
    loggedInMsg: "✔ You are logged in!",
    tabSingle: "Single Link",
    tabMulti: "Multiple Links",
    tabDevice: "Local Device File",
    lblFileUrl: "File Link (URL):",
    lblFileUrls: "File Links (URLs):",
    btnCheck: "Check File (Size & Format)",
    checking: "Checking file...",
    lblFileName: "File Name (Optional):",
    lblFolder: "Select Folder:",
    optRoot: "Main Drive (Root)",
    optNewFolder: "+ Create New Folder",
    btnCreateFolder: "Create Folder",
    lblExtractZip: "Extract ZIP file (keeps folder structure)",
    btnUpload: "Save to Drive",
    btnDeviceUpload: "Upload File to Drive",
    placeholderName: "New Folder Name",
    dropzone: "Drop file here or click to browse",
    dvacTitle: "Drive Video to Audio (D-VAC)",
    dvacDesc: "Select a video from your Drive and extract high-quality 192kbps MP3 directly in the cloud.",
    backToHub: "← Back to Tools Hub",
    openTool: "Launch Tool",
    privacyNotice: "How this app uses your data:",
    privacyText: "MZ Drive Utilities (File In Drive Upload & D-VAC) accesses Google Drive APIs solely to process, convert, and upload files specified by you. We do not view, permanently store, or share your private Google Drive files.",
    format: "Format",
    size: "Size",
    error: "Error",
    techError: "Technical Error",
    doneMsg: "✔ File saved!",
    zipDoneMsg: "✔ ZIP extracted and saved!",
    viewMsg: "View in Drive",
    complete: "Complete!",
    processing: "Processing file {i} / {total}...",
    allComplete: "All {success} / {total} files uploaded successfully.",
    converting: "Converting video to 192kbps MP3 via FFmpeg...",
    convWait: "This may take 2 to 4 minutes for longer videos. (If backend was sleeping on Render, the initial start takes ~45s to wake up). Please keep this tab open.",
    convSuccess: "✅ Conversion completed successfully!",
    convSuccessDesc: "Your MP3 has been saved to your Google Drive.",
    selectVideo: "Select Video from Drive",
    sharedNote: "Videos shared with you are also supported",
    grantPermission: "🔐 Grant Full Drive Access",
    permRequired: "⚠️ Google Drive Permission Required: MZ Drive Utilities needs permission to read this video from your Google Drive. Please click below to grant full Drive access and re-authenticate.",
    orEnterLink: "Or Paste Google Drive Video Link / File ID:",
    pastePlaceholder: "e.g. https://drive.google.com/file/d/... or File ID",
    applyVideo: "Load Video",
    errNoUrl: "Please enter a URL first",
    errNoUrls: "Please enter at least one URL",
    folderReq: "Please create a folder or select another one",
    signingIn: "Signing in with Google...",
    directGisBtn: "Sign in with Google OAuth (Alternative)",
    loginFailed: "Sign in issue detected. If an ad-blocker or strict popup privacy is active, click below to authenticate with direct Google OAuth:",
    tryAgain: "Try Again"
  },
  ur: {
    appTitle: "فائل ان ڈرائیو اپ لوڈ",
    appDesc: "\"فائل ان ڈرائیو اپلوڈ\" ایک ایسی ویب ایپلی کیشن ہے جو صارفین کو محفوظ گوگل OAuth تصدیق کے ذریعے براہ راست اپنے ذاتی گوگل ڈرائیو اکاؤنٹ میں فائلیں منتخب کرنے اور اپلوڈ کرنے کی سہولت فراہم کرتی ہے۔",
    hubTitle: "MZ ڈرائیو یوٹیلیٹیز",
    hubDesc: "آپ کے گوگل ڈرائیو اسٹوریج کے لیے کلاؤڈ یوٹیلیٹیز کا ایک مکمل سوٹ۔",
    loginTitle: "MZ ڈرائیو یوٹیلیٹیز",
    loginSubtitle: "گوگل ڈرائیو کلاؤڈ ٹولز سوٹ",
    loginDesc: "ایم زیڈ ڈرائیو یوٹیلیٹیز گوگل ڈرائیو کے لیے جدید کلاؤڈ ٹولز کا ایک جامع پلیٹ فارم ہے۔ ویب لنکس، مقامی فائلیں اور زپ فائلز براہِ راست ڈرائیو میں محفوظ کریں یا ڈرائیو ویڈیوز کو کلاؤڈ پر 192kbps MP3 آڈیو میں تبدیل کریں۔",
    feature1Title: "فائل ان ڈرائیو اپ لوڈ",
    feature1Desc: "ویب لنکس اور کمپیوٹر سے فائلیں براہ راست گوگل ڈرائیو پر اپلوڈ کریں بمعہ زپ ایکسٹراکٹ۔",
    feature2Title: "ویڈیو ٹو آڈیو کنورٹر (D-VAC)",
    feature2Desc: "گوگل ڈرائیو ویڈیوز کو کلاؤڈ FFmpeg کے ذریعے 192kbps MP3 میں تبدیل کریں۔",
    loginText: "پہلے اپنے گوگل اکاؤنٹ سے لاگ ان کریں:",
    loginBtn: "گوگل سے لاگ ان کریں",
    loggedInMsg: "✔ آپ لاگ ان ہو چکے ہیں!",
    tabSingle: "ایک لنک",
    tabMulti: "ایک سے زائد لنکس",
    tabDevice: "کمپیوٹر سے فائل",
    lblFileUrl: "فائل کا لنک (URL):",
    lblFileUrls: "فائل کے لنکس (URLs):",
    btnCheck: "فائل چیک کریں (سائز اور فارمیٹ)",
    checking: "فائل چیک ہو رہی ہے...",
    lblFileName: "فائل کا نام (اختیاری):",
    lblFolder: "فولڈر منتخب کریں:",
    optRoot: "مرکزی ڈرائیو (Root)",
    optNewFolder: "+ نیا فولڈر بنائیں",
    btnCreateFolder: "فولڈر بنائیں",
    lblExtractZip: "زپ فائل کو ایکسٹراکٹ کریں (فولڈر اسٹرکچر برقرار رہے گا)",
    btnUpload: "ڈرائیو میں محفوظ کریں",
    btnDeviceUpload: "فائل ڈرائیو پر اپ لوڈ کریں",
    placeholderName: "نئے فولڈر کا نام",
    dropzone: "فائل یہاں ڈراپ کریں یا کلک کریں",
    dvacTitle: "ویڈیو ٹو آڈیو کنورٹر (D-VAC)",
    dvacDesc: "اپنی ڈرائیو سے ویڈیو منتخب کریں اور کلاؤڈ پر براہ راست 192kbps MP3 نکالیں۔",
    backToHub: "← ٹولز ہب پر واپس جائیں",
    openTool: "ٹول شروع کریں",
    privacyNotice: "یہ ایپ آپ کا ڈیٹا کیسے استعمال کرتی ہے:",
    privacyText: "ایم زیڈ ڈرائیو یوٹیلیٹیز (فائل ان ڈرائیو اپلوڈ اور D-VAC سمیت) صرف آپ کی منتخب کردہ فائلوں کو اپلوڈ اور کنورٹ کرنے کے لیے ڈرائیو API استعمال کرتی ہے۔ آپ کی فائلز سرور پر مستقل محفوظ نہیں ہوتیں۔",
    format: "فارمیٹ",
    size: "سائز",
    error: "خرابی",
    techError: "تکنیکی خرابی",
    doneMsg: "✔ فائل محفوظ ہو گئی!",
    zipDoneMsg: "✔ زپ فائل ایکسٹراکٹ ہو کر محفوظ ہو گئی!",
    viewMsg: "ڈرائیو میں دیکھیں",
    complete: "مکمل!",
    processing: "فائل {i} / {total} پروسیس ہو رہی ہے...",
    allComplete: "تمام {success} / {total} فائلز کامیابی سے اپلوڈ ہوئیں۔",
    converting: "ویڈیو کو 192kbps MP3 میں تبدیل کیا جا رہا ہے...",
    convWait: "بڑی ویڈیوز میں 2 سے 4 منٹ لگ سکتے ہیں۔ (اگر رینڈر سرور سلیپ موڈ میں تھا تو پہلے آغاز میں تقریباً 45 سیکنڈ لگ سکتے ہیں)۔ براہ کرم یہ ٹیب کھلا رکھیں۔",
    convSuccess: "✅ کنورژن کامیابی سے مکمل ہو گئی!",
    convSuccessDesc: "آپ کی MP3 فائل گوگل ڈرائیو میں محفوظ کر دی گئی ہے۔",
    selectVideo: "ڈرائیو سے ویڈیو منتخب کریں",
    sharedNote: "شیئر کردہ ویڈیوز بھی سپورٹڈ ہیں",
    grantPermission: "🔐 مکمل گوگل ڈرائیو کی اجازت دیں",
    permRequired: "⚠️ گوگل ڈرائیو اجازت درکار ہے: ویڈیو پڑھنے کے لیے مکمل اجازت درکار ہے۔ براہ کرم نیچے دیے گئے بٹن پر کلک کر کے مکمل اجازت دیں۔",
    orEnterLink: "یا گوگل ڈرائیو ویڈیو کا لنک / فائل ID درج کریں:",
    pastePlaceholder: "مثلاً https://drive.google.com/file/d/... یا فائل ID",
    applyVideo: "ویڈیو منتخب کریں",
    errNoUrl: "پہلے URL درج کریں",
    errNoUrls: "براہ کرم کم از کم ایک URL درج کریں",
    folderReq: "براہ کرم فولڈر بنائیں یا کوئی دوسرا فولڈر منتخب کریں",
    signingIn: "گوگل سے لاگ ان کیا جا رہا ہے...",
    directGisBtn: "متبادل گوگل OAuth سے لاگ ان کریں",
    loginFailed: "لاگ ان میں دشواری پیش آئی۔ اگر ایڈ بلاکر آن ہے یا پاپ اپ بلاک ہوا ہے، تو نیچے متبادل ڈائریکٹ OAuth بٹن استعمال کریں:",
    tryAgain: "دوبارہ کوشش کریں"
  }
};

// --- Shared Navigation Header ---
const NavHeader = ({ 
  user, 
  handleLogout, 
  theme, 
  setTheme, 
  lang, 
  setLang 
}: { 
  user: AppUser | null; 
  handleLogout: () => void; 
  theme: Theme; 
  setTheme: (t: Theme) => void;
  lang: Language;
  setLang: (l: Language) => void;
}) => (
  <header className={`px-6 py-4 sticky top-0 z-50 transition-colors border-b ${
    theme === 'dark' ? 'bg-[#18181b]/90 border-slate-800 text-white' : 'bg-white/90 border-slate-200 text-slate-900'
  } backdrop-blur-md`}>
    <div className="max-w-6xl mx-auto flex justify-between items-center">
      <Link to="/" className="flex items-center gap-3 group">
        <img 
          src="/logo.png" 
          alt="Logo" 
          className="w-10 h-10 rounded-xl object-cover shadow-md group-hover:scale-105 transition-transform"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <div>
          <h1 className="text-lg font-bold tracking-tight leading-tight">MZ Drive Utilities</h1>
          <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest leading-none mt-0.5">
            File In Drive Upload & D-VAC
          </p>
        </div>
      </Link>
      
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={`p-2 rounded-xl border text-sm transition-colors cursor-pointer ${
            theme === 'dark' 
              ? 'border-slate-700 bg-slate-800/60 text-yellow-400 hover:bg-slate-800' 
              : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button 
          onClick={() => setLang(lang === 'en' ? 'ur' : 'en')}
          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
            theme === 'dark' 
              ? 'border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800' 
              : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {lang === 'en' ? 'اردو' : 'English'}
        </button>

        {user && (
          <div className="flex items-center gap-2 pl-3 border-l border-slate-700/30">
            <div className={`flex items-center gap-2 text-xs font-semibold py-1 px-2.5 rounded-full border ${
              theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}>
              <img src={user.photoURL || ''} alt="" className="w-5 h-5 rounded-full" />
              <span className="max-w-[90px] truncate">{user.displayName?.split(' ')[0]}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  </header>
);

// ==========================================
// 1. HUB / LANDING PAGE
// ==========================================
const HubPage = ({ 
  user, 
  handleLogin, 
  isLoggingIn = false,
  loginError = null,
  theme, 
  lang 
}: { 
  user: AppUser | null; 
  handleLogin: (useGisDirect?: boolean) => void; 
  isLoggingIn?: boolean;
  loginError?: string | null;
  theme: Theme; 
  lang: Language;
}) => {
  const t = i18n[lang];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {!user ? (
        <div className="max-w-xl mx-auto mt-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-3xl p-8 sm:p-10 shadow-2xl border transition-all text-center ${
              theme === 'dark' ? 'bg-[#18181b] border-slate-800' : 'bg-white border-slate-100'
            }`}
          >
            {/* Branding Logo */}
            <div className="relative inline-block mx-auto mb-4">
              <img 
                src="/logo.png" 
                alt="MZ Drive Utilities" 
                className="w-20 h-20 rounded-2xl mx-auto shadow-xl object-cover ring-4 ring-blue-500/20"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-1 rounded-lg shadow">
                <Cloud size={16} />
              </div>
            </div>

            {/* Pill Tag */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20 mb-3">
              <span>{t.loginSubtitle}</span>
            </div>

            {/* Main Title */}
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500">
              {t.loginTitle}
            </h2>
            
            <p className={`text-sm leading-relaxed mb-6 max-w-lg mx-auto ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {t.loginDesc}
            </p>

            {/* Included Tools Showcase Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 text-start">
              <div className={`p-4 rounded-2xl border transition-all ${
                theme === 'dark' ? 'bg-slate-900/60 border-slate-800/80' : 'bg-slate-50 border-slate-200/80'
              }`}>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
                    <FileUp size={18} />
                  </div>
                  <h4 className="text-xs font-bold text-blue-500 truncate">{t.feature1Title}</h4>
                </div>
                <p className={`text-[11px] leading-snug ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t.feature1Desc}
                </p>
              </div>

              <div className={`p-4 rounded-2xl border transition-all ${
                theme === 'dark' ? 'bg-slate-900/60 border-slate-800/80' : 'bg-slate-50 border-slate-200/80'
              }`}>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center shrink-0">
                    <FileAudio size={18} />
                  </div>
                  <h4 className="text-xs font-bold text-indigo-500 truncate">{t.feature2Title}</h4>
                </div>
                <p className={`text-[11px] leading-snug ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t.feature2Desc}
                </p>
              </div>
            </div>

            {/* Login Error Alert with Direct Alternative */}
            {loginError && (
              <div className="mb-6 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs text-start flex flex-col gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="shrink-0 text-red-400 mt-0.5" size={18} />
                  <div className="flex-1">
                    <p className="font-bold">{t.loginFailed}</p>
                    <p className="text-[11px] opacity-80 mt-1 font-mono break-all">{loginError}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-red-500/20">
                  <button
                    onClick={() => handleLogin(true)}
                    disabled={isLoggingIn}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow cursor-pointer flex items-center gap-2"
                  >
                    <Cloud size={14} />
                    {t.directGisBtn}
                  </button>
                  <button
                    onClick={() => handleLogin(false)}
                    disabled={isLoggingIn}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl font-bold text-xs transition-all border border-slate-700 cursor-pointer"
                  >
                    {t.tryAgain}
                  </button>
                </div>
              </div>
            )}

            {/* Login with Google Button */}
            <button
              onClick={() => handleLogin(false)}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#ea4335] hover:bg-[#d33828] disabled:opacity-75 disabled:cursor-not-allowed text-white rounded-xl font-bold text-base transition-all active:scale-[0.98] shadow-lg shadow-red-500/20 cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>{t.signingIn}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  <span>{t.loginBtn}</span>
                </>
              )}
            </button>

            {/* Alternative Direct OAuth Button */}
            <button
              onClick={() => handleLogin(true)}
              disabled={isLoggingIn}
              className="mt-3.5 text-xs text-slate-400 hover:text-blue-400 transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
            >
              <span>🔑 {t.directGisBtn}</span>
            </button>

            {/* Privacy Transparency Notice */}
            <div className={`mt-8 p-4 rounded-xl border text-xs text-start leading-relaxed ${
              theme === 'dark' ? 'bg-[#121214] border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <strong className="block text-slate-300 mb-1">{t.privacyNotice}</strong>
              {t.privacyText}
            </div>
          </motion.div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight text-blue-500">{t.hubTitle}</h2>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {t.hubDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Tool Card 1: File In Drive Upload */}
            <Link to="/uploader" className="group">
              <div className={`rounded-3xl p-8 border transition-all h-full flex flex-col justify-between ${
                theme === 'dark' 
                  ? 'bg-[#18181b] border-slate-800 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10' 
                  : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-xl'
              }`}>
                <div>
                  <div className="w-14 h-14 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                    <FileUp size={28} />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-blue-500">{t.appTitle}</h3>
                  <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {t.appDesc}
                  </p>
                </div>
                <div className="mt-8 flex items-center gap-2 text-sm font-bold text-blue-500 group-hover:gap-3 transition-all">
                  {t.openTool} <ChevronRight size={18} className={lang === 'ur' ? 'rotate-180' : ''} />
                </div>
              </div>
            </Link>

            {/* Tool Card 2: D-VAC */}
            <Link to="/dvac" className="group">
              <div className={`rounded-3xl p-8 border transition-all h-full flex flex-col justify-between ${
                theme === 'dark' 
                  ? 'bg-[#18181b] border-slate-800 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10' 
                  : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-xl'
              }`}>
                <div>
                  <div className="w-14 h-14 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                    <FileAudio size={28} />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-indigo-500">{t.dvacTitle}</h3>
                  <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {t.dvacDesc}
                  </p>
                </div>
                <div className="mt-8 flex items-center gap-2 text-sm font-bold text-indigo-500 group-hover:gap-3 transition-all">
                  {t.openTool} <ChevronRight size={18} className={lang === 'ur' ? 'rotate-180' : ''} />
                </div>
              </div>
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// ==========================================
// 2. TOOL 1: FILE IN DRIVE UPLOAD (/uploader)
// ==========================================
const UploaderPage = ({ 
  token, 
  theme, 
  lang 
}: { 
  token: string | null; 
  theme: Theme; 
  lang: Language;
}) => {
  const t = i18n[lang];
  const [mode, setMode] = useState<'single' | 'multi' | 'device'>('single');
  
  // Single Link inputs
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileInfo, setFileInfo] = useState<{ mimeType?: string; size?: string; error?: string } | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Multi Links inputs
  const [fileUrls, setFileUrls] = useState('');

  // Device File inputs
  const [deviceFile, setDeviceFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Folders
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('root');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Options & Status
  const [extractZip, setExtractZip] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusColor, setStatusColor] = useState<'blue' | 'green' | 'red'>('blue');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressText, setProgressText] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; id: string; link?: string }>>([]);

  // Load user's folders from Google Drive
  useEffect(() => {
    if (!token) return;
    const fetchFolders = async () => {
      try {
        const q = "mimeType='application/vnd.google-apps.folder' and trashed=false";
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=50`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.files && Array.isArray(data.files)) {
          setFolders(data.files);
        }
      } catch (err) {
        console.warn('Could not load drive folders:', err);
      }
    };
    fetchFolders();
  }, [token]);

  // Check remote file size and format (HEAD / GET request via server API)
  const handleCheckFile = async () => {
    if (!fileUrl.trim()) {
      setFileInfo({ error: t.errNoUrl });
      return;
    }

    setIsChecking(true);
    setFileInfo(null);

    try {
      const res = await fetch(getApiUrl('/api/check-file'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: fileUrl.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setFileInfo({
          mimeType: data.mimeType,
          size: data.size ? formatBytes(parseInt(data.size)) : (lang === 'ur' ? 'نامعلوم' : 'Unknown'),
        });
      } else {
        setFileInfo({ error: data.error || (lang === 'ur' ? 'معلومات حاصل نہیں ہو سکیں' : 'Could not inspect file') });
      }
    } catch (e: any) {
      setFileInfo({ error: e.message || t.techError });
    } finally {
      setIsChecking(false);
    }
  };

  // Create folder inside Google Drive
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !token) return;
    setIsCreatingFolder(true);

    try {
      const res = await fetch(getApiUrl('/api/create-folder'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ folderName: newFolderName.trim() }),
      });
      const data = await res.json();
      if (data.success && data.folder) {
        setFolders(prev => [data.folder, ...prev]);
        setSelectedFolder(data.folder.id);
        setShowNewFolder(false);
        setNewFolderName('');
      } else {
        alert(`${t.error}: ${data.error || 'Failed to create folder'}`);
      }
    } catch (err: any) {
      alert(`${t.techError}: ${err.message}`);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Start URL Upload (Single or Multi via streamed NDJSON)
  const handleStartUrlUpload = async () => {
    if (!token) return;

    let urls: string[] = [];
    if (mode === 'single') {
      if (fileUrl.trim()) urls.push(fileUrl.trim());
    } else {
      urls = fileUrls.split('\n').map(u => u.trim()).filter(Boolean);
    }

    if (urls.length === 0) {
      setStatusColor('red');
      setStatusMessage(mode === 'single' ? t.errNoUrl : t.errNoUrls);
      return;
    }

    if (selectedFolder === 'new') {
      alert(t.folderReq);
      return;
    }

    setIsUploading(true);
    setProgressPercent(0);
    setProgressText('0%');
    setUploadedFiles([]);

    let overallSuccessCount = 0;

    for (let i = 0; i < urls.length; i++) {
      const currentUrl = urls[i];
      const processingMsg = t.processing.replace('{i}', String(i + 1)).replace('{total}', String(urls.length));
      setStatusColor('blue');
      setStatusMessage(processingMsg);
      setProgressPercent(0);
      setProgressText('0%');

      try {
        const apiPath = extractZip ? '/api/upload-zip-stream' : '/api/upload-stream';
        const endpoint = getApiUrl(apiPath);
        const payload: any = {
          fileUrl: currentUrl,
          folderId: selectedFolder,
        };
        if (mode === 'single' && fileName.trim()) {
          payload.fileName = fileName.trim();
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.body) throw new Error('ReadableStream not supported in this browser.');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let buffer = '';

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;

          if (value) {
            buffer += decoder.decode(value, { stream: !done });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const data = JSON.parse(line);
                if (data.type === 'status') {
                  setStatusColor('blue');
                  setStatusMessage(`[${i + 1}/${urls.length}] ${data.message}`);
                } else if (data.type === 'progress') {
                  if (data.percent !== undefined) {
                    setProgressPercent(data.percent);
                    setProgressText(`${data.percent}% (${formatBytes(data.bytes)} / ${formatBytes(data.total)})`);
                  } else {
                    setProgressPercent(100);
                    setProgressText(`${formatBytes(data.bytes)}...`);
                  }
                } else if (data.type === 'success') {
                  overallSuccessCount++;
                  setProgressPercent(100);
                  setProgressText(t.complete);
                  setStatusColor('green');
                  if (data.isZip) {
                    setStatusMessage(`[${i + 1}/${urls.length}] ${t.zipDoneMsg} ${data.message || ''}`);
                  } else {
                    setStatusMessage(`[${i + 1}/${urls.length}] ${t.doneMsg}`);
                    if (data.file) {
                      setUploadedFiles(prev => [...prev, { name: data.file.name, id: data.file.id, link: data.file.webViewLink }]);
                    }
                  }
                } else if (data.type === 'error') {
                  setStatusColor('red');
                  setStatusMessage(`[${i + 1}/${urls.length}] ${t.error}: ${data.message}`);
                }
              } catch (parseErr) {
                console.warn('NDJSON parse error:', line);
              }
            }
          }
        }
      } catch (err: any) {
        setStatusColor('red');
        setStatusMessage(`[${i + 1}/${urls.length}] ${t.techError}: ${err.message}`);
      }
    }

    const allDoneMsg = t.allComplete.replace('{success}', String(overallSuccessCount)).replace('{total}', String(urls.length));
    setStatusColor('green');
    setStatusMessage(allDoneMsg);
    setIsUploading(false);
  };

  // Direct Device Upload (XHR multipart upload direct to Drive)
  const handleDeviceUpload = async () => {
    if (!deviceFile || !token) return;

    if (deviceFile.size > 100 * 1024 * 1024) {
      setStatusColor('red');
      setStatusMessage('File exceeds the 100MB direct upload limit.');
      return;
    }

    setIsUploading(true);
    setProgressPercent(0);
    setProgressText('0%');
    setStatusColor('blue');
    setStatusMessage(`Uploading "${deviceFile.name}" (${formatBytes(deviceFile.size)})...`);

    try {
      const boundary = '-------314159265358979323846';
      const metadata: any = {
        name: deviceFile.name,
        mimeType: deviceFile.type || 'application/octet-stream',
      };
      if (selectedFolder !== 'root' && selectedFolder !== 'new') {
        metadata.parents = [selectedFolder];
      }

      const prePart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${deviceFile.type || 'application/octet-stream'}\r\n\r\n`;
      const postPart = `\r\n--${boundary}--`;

      const bodyBlob = new Blob([prePart, deviceFile, postPart], {
        type: `multipart/related; boundary=${boundary}`,
      });

      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setProgressPercent(percent);
          setProgressText(`${percent}% (${formatBytes(e.loaded)} / ${formatBytes(e.total)})`);
        }
      };

      const uploadPromise = new Promise<{ id: string; name: string; webViewLink?: string }>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (parseErr) {
              reject(parseErr);
            }
          } else {
            reject(new Error(`Google API returned ${xhr.status}: ${xhr.responseText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.ontimeout = () => reject(new Error('Upload timed out'));
      });

      xhr.send(bodyBlob);

      const resData = await uploadPromise;
      setStatusColor('green');
      setStatusMessage(`${t.doneMsg} ${resData.name}`);
      setProgressPercent(100);
      setProgressText(t.complete);
      setUploadedFiles(prev => [...prev, { name: resData.name, id: resData.id, link: resData.webViewLink }]);
    } catch (err: any) {
      setStatusColor('red');
      setStatusMessage(`${t.error}: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <Link 
        to="/" 
        className={`inline-flex items-center gap-2 font-bold text-sm transition-colors mb-2 cursor-pointer ${
          theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <ArrowLeft size={16} className={lang === 'ur' ? 'rotate-180' : ''} />
        {t.backToHub}
      </Link>

      <div className={`rounded-3xl p-8 sm:p-10 shadow-2xl border transition-all ${
        theme === 'dark' ? 'bg-[#18181b] border-slate-800' : 'bg-white border-slate-100'
      }`}>
        {/* App Title Header */}
        <div className="text-center mb-8">
          <img 
            src="/logo.png" 
            alt="File In Drive Upload" 
            className="w-24 h-24 rounded-2xl mx-auto mb-4 shadow-md object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-blue-500 mb-2">
            {t.appTitle}
          </h2>
          <p className={`text-xs sm:text-sm leading-relaxed max-w-md mx-auto ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            {t.appDesc}
          </p>
        </div>

        {/* Mode Tabs */}
        <div className={`flex p-1 rounded-xl mb-6 ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}>
          <button 
            onClick={() => setMode('single')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'single' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.tabSingle}
          </button>
          <button 
            onClick={() => setMode('multi')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'multi' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.tabMulti}
          </button>
          <button 
            onClick={() => setMode('device')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'device' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.tabDevice}
          </button>
        </div>

        {/* Tab 1: Single Link */}
        {mode === 'single' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                {t.lblFileUrl}
              </label>
              <input
                type="url"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://example.com/file.mp4"
                className={`w-full p-3 rounded-xl border text-sm font-medium transition-colors ${
                  theme === 'dark' 
                    ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' 
                    : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                }`}
              />
            </div>

            <button
              onClick={handleCheckFile}
              disabled={isChecking || !fileUrl.trim()}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors border cursor-pointer ${
                theme === 'dark' 
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 disabled:opacity-50' 
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 disabled:opacity-50'
              }`}
            >
              {isChecking ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> {t.checking}
                </span>
              ) : t.btnCheck}
            </button>

            {fileInfo && (
              <div className={`p-3 rounded-xl text-xs font-medium border ${
                fileInfo.error 
                  ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                  : 'bg-green-500/10 border-green-500/20 text-green-400'
              }`}>
                {fileInfo.error ? (
                  <span>❌ {fileInfo.error}</span>
                ) : (
                  <span>✔ {t.format}: <b>{fileInfo.mimeType}</b> | {t.size}: <b>{fileInfo.size}</b></span>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                {t.lblFileName}
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="my_file.mp4"
                className={`w-full p-3 rounded-xl border text-sm font-medium transition-colors ${
                  theme === 'dark' 
                    ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' 
                    : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                }`}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Multi Links */}
        {mode === 'multi' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                {t.lblFileUrls}
              </label>
              <textarea
                rows={4}
                value={fileUrls}
                onChange={(e) => setFileUrls(e.target.value)}
                placeholder={`https://example.com/file1.mp4\nhttps://example.com/file2.zip`}
                className={`w-full p-3 rounded-xl border text-sm font-mono transition-colors ${
                  theme === 'dark' 
                    ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' 
                    : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                }`}
              />
            </div>
          </div>
        )}

        {/* Tab 3: Local Device File */}
        {mode === 'device' && (
          <div className="space-y-4">
            <div
              onClick={() => !isUploading && fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) setDeviceFile(e.dataTransfer.files[0]);
              }}
              className={`p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                theme === 'dark' 
                  ? 'border-slate-700 bg-slate-900/50 hover:border-blue-500/50 hover:bg-blue-500/5' 
                  : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/30'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => { if (e.target.files?.[0]) setDeviceFile(e.target.files[0]); }}
                className="hidden"
              />
              <Upload size={32} className="mx-auto mb-3 text-blue-500" />
              <p className="text-sm font-bold">
                {deviceFile ? deviceFile.name : t.dropzone}
              </p>
              {deviceFile && (
                <p className="text-xs text-blue-400 font-bold mt-1">
                  {formatBytes(deviceFile.size)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Folder Selection (Shared across all modes) */}
        <div className="mt-6 pt-6 border-t border-slate-800/20 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
            {t.lblFolder}
          </label>
          <select
            value={selectedFolder}
            onChange={(e) => {
              setSelectedFolder(e.target.value);
              if (e.target.value === 'new') setShowNewFolder(true);
              else setShowNewFolder(false);
            }}
            className={`w-full p-3 rounded-xl border text-sm font-medium transition-colors ${
              theme === 'dark' 
                ? 'bg-slate-900 border-slate-700 text-white' 
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <option value="root">{t.optRoot}</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>📁 {f.name}</option>
            ))}
            <option value="new">{t.optNewFolder}</option>
          </select>

          {showNewFolder && (
            <div className={`p-3 rounded-xl border space-y-2 ${
              theme === 'dark' ? 'bg-slate-900/80 border-slate-700' : 'bg-slate-100 border-slate-200'
            }`}>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t.placeholderName}
                className={`w-full p-2.5 rounded-lg border text-xs font-medium ${
                  theme === 'dark' ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
              <button
                type="button"
                onClick={handleCreateFolder}
                disabled={isCreatingFolder || !newFolderName.trim()}
                className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {isCreatingFolder ? 'Creating...' : t.btnCreateFolder}
              </button>
            </div>
          )}

          {mode !== 'device' && (
            <div className="pt-2">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-red-500">
                <input
                  type="checkbox"
                  checked={extractZip}
                  onChange={(e) => setExtractZip(e.target.checked)}
                  className="rounded border-slate-700 cursor-pointer"
                />
                <span>{t.lblExtractZip}</span>
              </label>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-8">
          <button
            onClick={mode === 'device' ? handleDeviceUpload : handleStartUrlUpload}
            disabled={isUploading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-base transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Cloud size={18} />
                <span>{mode === 'device' ? t.btnDeviceUpload : t.btnUpload}</span>
              </>
            )}
          </button>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={`mt-4 p-3 rounded-xl text-xs font-bold text-center border ${
            statusColor === 'green' 
              ? 'bg-green-500/10 border-green-500/20 text-green-400' 
              : statusColor === 'red' 
              ? 'bg-red-500/10 border-red-500/20 text-red-400' 
              : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
          }`}>
            {statusMessage}
          </div>
        )}

        {/* Progress Bar */}
        {isUploading && (
          <div className="mt-4 space-y-1.5">
            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                className="h-full bg-green-500 rounded-full transition-all duration-300"
              />
            </div>
            {progressText && (
              <p className="text-[11px] font-bold text-slate-400 text-center">{progressText}</p>
            )}
          </div>
        )}

        {/* Uploaded Files Links List */}
        {uploadedFiles.length > 0 && (
          <div className={`mt-6 p-4 rounded-xl border space-y-2 ${
            theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <p className="text-xs font-bold text-green-500 uppercase tracking-wider mb-2">
              Uploaded Files:
            </p>
            {uploadedFiles.map((f, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/30 last:border-b-0">
                <span className="font-semibold truncate max-w-[200px]">{f.name}</span>
                {f.link && (
                  <a 
                    href={f.link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    {t.viewMsg} <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 3. TOOL 2: D-VAC CONVERTER (/dvac)
// ==========================================
function extractDriveFileId(input: string): string {
  const trimmed = input.trim();
  const match1 = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1 && match1[1]) return match1[1];
  const match2 = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2 && match2[1]) return match2[1];
  return trimmed;
}

const DvacPage = ({ 
  token, 
  theme, 
  lang,
  onReauth
}: { 
  token: string | null; 
  theme: Theme; 
  lang: Language;
  onReauth?: () => Promise<void> | void;
}) => {
  const t = i18n[lang];
  const [dvacStatus, setDvacStatus] = useState<'idle' | 'loading' | 'converting' | 'success' | 'error'>('idle');
  const [dvacError, setDvacError] = useState('');
  const [isPermissionError, setIsPermissionError] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [dvacResult, setDvacResult] = useState<{ file_id?: string; link?: string; success?: boolean } | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<{ id: string; name: string } | null>(null);

  // Silent ping to wake up the Render backend if asleep on free tier
  useEffect(() => {
    fetch(getApiUrl('/api/health')).catch(() => {});
  }, []);

  const handlePickVideo = async () => {
    if (!token) return;
    try {
      await openPicker(token, (file) => {
        setSelectedVideo(file);
        setDvacStatus('idle');
        setDvacResult(null);
        setDvacError('');
        setIsPermissionError(false);
      });
    } catch (err) {
      console.error(err);
      setDvacError('Failed to open Google Drive picker.');
    }
  };

  const handleApplyManualInput = () => {
    const raw = manualInput.trim();
    if (!raw) return;
    const extractedId = extractDriveFileId(raw);
    if (!extractedId) return;
    setSelectedVideo({
      id: extractedId,
      name: `Drive Video (${extractedId.length > 14 ? extractedId.slice(0, 10) + '...' : extractedId})`
    });
    setDvacStatus('idle');
    setDvacResult(null);
    setDvacError('');
    setIsPermissionError(false);
  };

  const handleConvert = async () => {
    if (!selectedVideo || !token) return;
    setDvacStatus('converting');
    setDvacError('');
    setIsPermissionError(false);

    try {
      // 10-minute timeout support via AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000);

      const response = await fetch(getApiUrl('/api/convert'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: token,
          file_id: selectedVideo.id,
          file_name: selectedVideo.name,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Server returned ${response.status}`);
      }

      const data = await response.json();
      if (data.success || data.status === 'success') {
        const fileId = data.file_id || data.fileId;
        const webLink = data.link || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : undefined);
        const normalized = {
          ...data,
          success: true,
          file_id: fileId,
          link: webLink,
        };
        setDvacResult(normalized);
        setDvacStatus('success');
      } else {
        throw new Error(data.error || data.detail || data.message || 'Conversion failed at backend');
      }
    } catch (err: any) {
      console.error('D-VAC Conversion Error:', err);
      setDvacStatus('error');
      let msg = err.message || '';
      try {
        if (msg.includes('{"detail":')) {
          const parsed = JSON.parse(msg);
          msg = parsed.detail || msg;
        }
      } catch {}

      const isSessionExpired = 
        msg.includes('refresh the access token') ||
        msg.includes('login session has expired') ||
        msg.includes('necessary fields') ||
        msg.includes('invalid_grant') ||
        msg.includes('401');

      const isPermissionErr = 
        !isSessionExpired && (
          msg.includes('appNotAuthorizedToFile') || 
          msg.includes('read access to the file') || 
          msg.includes('not granted the app') ||
          msg.includes('insufficientFilePermissions') ||
          (msg.includes('403') && !msg.includes('cannotDownloadFile'))
        );

      if (isSessionExpired) {
        setIsPermissionError(true);
        setDvacError(
          lang === 'ur' 
            ? '⚠️ آپ کا گوگل لاگ ان سیشن ختم (Expire) ہو چکا ہے۔ براہ کرم اوپر دائیں جانب موجود لاگ آؤٹ بٹن پر کلک کر کے دوبارہ لاگ ان کریں۔' 
            : '⚠️ Your Google login session has expired. Please log out and log in again to refresh your session.'
        );
      } else if (isPermissionErr) {
        setIsPermissionError(true);
        setDvacError(t.permRequired);
      } else if (msg.includes('cannotDownloadFile') || msg.includes('cannot be downloaded')) {
        setIsPermissionError(false);
        setDvacError('⚠️ This video has download restrictions set by its owner and cannot be processed. Please select a video that allows downloading or one from your own Drive.');
      } else if (msg.includes('Invalid data found')) {
        setIsPermissionError(false);
        setDvacError('⚠️ The video file is corrupted or unsupported.');
      } else if (err.name === 'AbortError') {
        setIsPermissionError(false);
        setDvacError('⚠️ Conversion timed out after 10 minutes. The file may be too large.');
      } else if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        setIsPermissionError(false);
        setDvacError('⚠️ Network timeout. The conversion might still be running on the Render server.');
      } else {
        setIsPermissionError(false);
        setDvacError(msg || 'Something went wrong during conversion.');
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <Link 
        to="/" 
        className={`inline-flex items-center gap-2 font-bold text-sm transition-colors mb-2 cursor-pointer ${
          theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <ArrowLeft size={16} className={lang === 'ur' ? 'rotate-180' : ''} />
        {t.backToHub}
      </Link>

      <div className={`rounded-3xl p-8 sm:p-10 shadow-2xl border transition-all ${
        theme === 'dark' ? 'bg-[#18181b] border-slate-800' : 'bg-white border-slate-100'
      }`}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center">
              <FileAudio size={28} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-indigo-500">
                {t.dvacTitle}
              </h2>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                Cloud MP3 Extractor (192kbps)
              </p>
            </div>
          </div>
          {(dvacStatus !== 'idle' || selectedVideo) && (
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              dvacStatus === 'converting' ? 'bg-indigo-500/20 text-indigo-400 animate-pulse' :
              dvacStatus === 'success' ? 'bg-green-500/20 text-green-400' :
              dvacStatus === 'error' ? 'bg-red-500/20 text-red-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              {dvacStatus === 'converting' ? 'Converting...' : dvacStatus === 'idle' ? 'Ready' : dvacStatus}
            </div>
          )}
        </div>

        <button
          onClick={handlePickVideo}
          disabled={dvacStatus === 'converting'}
          className={`w-full py-14 border-2 border-dashed rounded-2xl text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
            dvacStatus === 'converting' 
              ? 'opacity-50 cursor-not-allowed' 
              : theme === 'dark' 
              ? 'border-slate-700 bg-slate-900/40 hover:border-indigo-500/50 hover:bg-indigo-500/5' 
              : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/20'
          }`}
        >
          <Video size={36} className="text-indigo-500 mb-3" />
          <p className="text-base font-bold px-4 break-words">
            {selectedVideo ? selectedVideo.name : t.selectVideo}
          </p>
          <p className="text-xs text-slate-500 mt-2 font-medium">{t.sharedNote}</p>
        </button>

        {/* Option to paste direct link or file ID */}
        <div className="mt-4 pt-4 border-t border-slate-700/30">
          <label className={`block text-xs font-semibold mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            {t.orEnterLink}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder={t.pastePlaceholder}
              disabled={dvacStatus === 'converting'}
              className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs font-mono transition-all ${
                theme === 'dark' 
                  ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-indigo-500' 
                  : 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
              } focus:outline-none`}
            />
            <button
              onClick={handleApplyManualInput}
              disabled={!manualInput.trim() || dvacStatus === 'converting'}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              {t.applyVideo}
            </button>
          </div>
        </div>

        {selectedVideo && dvacStatus !== 'success' && (
          <div className="mt-8">
            {dvacStatus === 'converting' ? (
              <div className={`p-6 rounded-2xl border text-center space-y-3 ${
                theme === 'dark' ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-200'
              }`}>
                <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto" />
                <p className="font-bold text-sm">{t.converting}</p>
                <p className={`text-xs max-w-sm mx-auto ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'}`}>
                  {t.convWait}
                </p>
              </div>
            ) : (
              <button
                onClick={handleConvert}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-base transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Music size={18} />
                <span>Extract 192kbps MP3</span>
              </button>
            )}
          </div>
        )}

        {dvacError && (
          <div className="mt-5 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-xs sm:text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <span>{dvacError}</span>
            </div>
            {isPermissionError && onReauth && (
              <div className="pt-2">
                <button
                  onClick={async () => {
                    try {
                      await onReauth();
                      setIsPermissionError(false);
                      setDvacError('');
                    } catch (e: any) {
                      console.error('Re-auth error:', e);
                    }
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all cursor-pointer inline-flex items-center gap-2 active:scale-95"
                >
                  <Cloud size={16} />
                  <span>{t.grantPermission}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {dvacStatus === 'success' && dvacResult && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-6 text-center space-y-4">
            <div className="w-16 h-16 bg-green-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-green-500/30">
              <CheckCircle size={36} />
            </div>
            <h4 className="text-xl font-bold">{t.convSuccess}</h4>
            <p className="text-xs text-slate-400">{t.convSuccessDesc}</p>
            <div className="flex gap-3 justify-center pt-2">
              {dvacResult.link && (
                <a
                  href={dvacResult.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-white text-slate-900 rounded-xl font-bold text-xs hover:bg-slate-100 transition-colors shadow"
                >
                  Open MP3 in Drive
                </a>
              )}
              <button
                onClick={() => {
                  setDvacStatus('idle');
                  setSelectedVideo(null);
                  setDvacResult(null);
                }}
                className="px-5 py-2.5 bg-slate-800 text-white border border-slate-700 rounded-xl font-bold text-xs hover:bg-slate-700 cursor-pointer"
              >
                Convert Another
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 4. MAIN APP WITH CENTRAL SESSION
// ==========================================
export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');
  const [lang, setLang] = useState<Language>('en');

  useEffect(() => {
    const unsubscribe = initAuth(
      (u, t) => {
        setUser(u);
        setToken(t);
        setIsInitializing(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setIsInitializing(false);
      }
    );
    loadGoogleApi();
    return () => unsubscribe();
  }, []);

  const handleLogin = async (useGisDirect = false) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const res = useGisDirect ? await signInWithGis() : await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
      }
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        const errorMsg = err?.message || 'Authentication failed. Please verify your internet connection or ad-blocker.';
        setLoginError(errorMsg);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#121214] text-white flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div 
        className={`min-h-screen font-sans flex flex-col transition-colors ${
          theme === 'dark' ? 'bg-[#121214] text-slate-100' : 'bg-[#f0f2f5] text-slate-900'
        }`}
        dir={lang === 'ur' ? 'rtl' : 'ltr'}
      >
        <NavHeader 
          user={user} 
          handleLogout={handleLogout} 
          theme={theme} 
          setTheme={setTheme} 
          lang={lang} 
          setLang={setLang} 
        />

        <main className="flex-1">
          <Routes>
            <Route 
              path="/" 
              element={
                <HubPage 
                  user={user} 
                  handleLogin={handleLogin} 
                  isLoggingIn={isLoggingIn} 
                  loginError={loginError} 
                  theme={theme} 
                  lang={lang} 
                />
              } 
            />
            <Route 
              path="/uploader" 
              element={
                user ? (
                  <UploaderPage token={token} theme={theme} lang={lang} />
                ) : (
                  <HubPage 
                    user={user} 
                    handleLogin={handleLogin} 
                    isLoggingIn={isLoggingIn} 
                    loginError={loginError} 
                    theme={theme} 
                    lang={lang} 
                  />
                )
              } 
            />
            <Route 
              path="/dvac" 
              element={
                user ? (
                  <DvacPage 
                    token={token} 
                    theme={theme} 
                    lang={lang} 
                    onReauth={() => handleLogin(false)} 
                  />
                ) : (
                  <HubPage 
                    user={user} 
                    handleLogin={handleLogin} 
                    isLoggingIn={isLoggingIn} 
                    loginError={loginError} 
                    theme={theme} 
                    lang={lang} 
                  />
                )
              } 
            />
          </Routes>
        </main>

        <footer className={`py-6 text-center text-xs border-t transition-colors ${
          theme === 'dark' ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
        }`}>
          <p>© 2026 MZ Drive Utilities Suite • File In Drive Upload & D-VAC</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}
