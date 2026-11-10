# Naukri page import helper

Use this only if Naukri results already open in your regular Chrome or Edge browser. It imports data from the page you can view; it does not make Naukri's blocked automated endpoint work.

1. Keep Job Applier running at `http://localhost:3000`. Choose your resume and click **Find matching jobs** before importing jobs.
2. Open Chrome's `chrome://extensions` or Edge's `edge://extensions`.
3. Turn on Developer mode, choose **Load unpacked**, and select `D:\BadekarEnterprises\JobApplier\browser-helper`.
4. Open a Naukri results page normally. Click this extension, then **Capture job data**.
5. Choose **Open Job Applier with these jobs** and confirm the preview in the app. Use the same localhost/127.0.0.1 address as your existing app tab so it finds that browser's saved resume.
6. To import a complete JD, open that job on Naukri and capture its job page too. Reimporting the same URL updates the saved job; changed requirements clear prior draft approval.

Alternatively save the capture JSON and choose **Import Naukri page capture** in the app.

Permissions are `activeTab` and `scripting`. Access is temporary and triggered by your capture click. There is no background worker, all-sites host permission, cookie access, remote server or automatic submission. Only job fields are transferred to the local app, through a URL fragment that the app removes immediately; no resume text or credentials are read by the helper. Imported content is untrusted and validated before preview/import.

If Naukri itself shows Access Denied or a verification page, the helper stops. Complete the normal sign-in/verification yourself, or use manual job-description import. Do not treat controlled-page tests as verification that real Naukri pages work in your browser.

After changing the shared parser, run `npm run build:browser-helper` and reload the extension. Remove the extension from your browser when you no longer need it.
