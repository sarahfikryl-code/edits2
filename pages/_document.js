import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme & App Settings */}
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Trackify" />
        <meta name="apple-touch-fullscreen" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Mr. Ahmad Badr Attendance System" />
        <meta property="og:title" content="Mr. Ahmad Badr Attendance System" />
        <meta property="og:description" content="Mr. Ahmad Badr Attendance System" />
        <meta property="og:image" content="/icons/apple-icon-180.png" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />

        {/* Camera Permission Policy */}
        <meta httpEquiv="Permissions-Policy" content="camera=(self)" />

        {/* Icons for iOS */}
        <link rel="icon" type="image/png" sizes="196x196" href="/icons/favicon-196.png" />
        <link rel="apple-touch-icon" href="/icons/apple-icon-180.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
