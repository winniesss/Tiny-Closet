
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-md mx-auto min-h-screen bg-orange-50 pb-12">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sky-500 font-bold text-sm mb-6"
      >
        <ArrowLeft size={18} /> Back
      </button>

      <h1 className="text-2xl font-bold text-slate-800 mb-2">Privacy Policy</h1>
      <p className="text-xs text-slate-400 mb-6">Last updated: March 26, 2026</p>

      <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
        <section>
          <h2 className="font-bold text-slate-800 mb-2">1. Overview</h2>
          <p>
            Tiny Closet ("the App") is a children's clothing management app designed for parents and guardians. We take your family's privacy seriously — the App is built with a "local-first" approach, meaning most data stays on your device.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-slate-800 mb-2">2. Information We Collect</h2>
          <p className="mb-2">When you use Tiny Closet, the following information may be collected:</p>
          <ul className="list-disc ml-5 space-y-1">
            <li><strong>Child's name</strong> — to personalize the experience</li>
            <li><strong>Child's date of birth</strong> — to help with size recommendations</li>
            <li><strong>Profile photo</strong> — optional avatar chosen by the parent</li>
            <li><strong>Clothing item photos</strong> — photos of clothing added to the closet</li>
            <li><strong>Location data</strong> — used solely for local weather forecasts to suggest weather-appropriate outfits; not stored or transmitted</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-slate-800 mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>Manage and organize your child's wardrobe</li>
            <li>Generate outfit suggestions using AI based on weather and clothing items</li>
            <li>Sync profile data (name, birthday, avatar) to the cloud for backup and device transfer</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-slate-800 mb-2">4. Data Storage</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li><strong>Local storage:</strong> All clothing photos, outfit history, and preferences are stored locally on your device using IndexedDB. They are never uploaded to our servers.</li>
            <li><strong>Cloud storage (Firebase):</strong> Only profile data (child's name, date of birth, and avatar) is synced to Google Firebase for backup purposes. This allows you to restore your profile on a new device.</li>
            <li><strong>Apple Sign In:</strong> If you sign in with Apple, your Apple ID is used as a secure identifier. We do not receive or store your email address unless you choose to share it.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-slate-800 mb-2">5. Children's Privacy (COPPA)</h2>
          <p>
            Tiny Closet is designed to be used by parents and guardians on behalf of their children. We do not knowingly collect personal information directly from children under 13. All data is entered and managed by the parent or guardian. By using this App, you confirm that you are the parent or legal guardian of the child whose information is entered, and you consent to the collection and use of that information as described in this policy.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-slate-800 mb-2">6. Third-Party Services</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li><strong>Google Firebase:</strong> Used for profile cloud backup and authentication. Subject to <a href="https://firebase.google.com/support/privacy" className="text-sky-500 underline" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a>.</li>
            <li><strong>Google Gemini AI:</strong> Clothing photos may be sent to Google's Generative AI API for item analysis (category, color, season detection). Images are processed but not stored by Google for model training.</li>
            <li><strong>Apple Sign In:</strong> Used for secure authentication on iOS devices. Subject to <a href="https://www.apple.com/legal/privacy/" className="text-sky-500 underline" target="_blank" rel="noopener noreferrer">Apple's Privacy Policy</a>.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-slate-800 mb-2">7. Data Deletion</h2>
          <p>
            You can delete all your data at any time through the App's Settings page under "Danger Zone." The "Delete Account & All Data" option will permanently remove all local data (clothing items, profiles, outfit history) and all cloud-stored data (Firebase profile backup). This action cannot be undone.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-slate-800 mb-2">8. Data Security</h2>
          <p>
            We use industry-standard security measures including Firebase Authentication, encrypted connections (HTTPS), and Firestore security rules to protect your data. However, no method of electronic storage is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-slate-800 mb-2">9. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Access your data through the App's Export feature</li>
            <li>Delete your data through the App's Settings page</li>
            <li>Withdraw consent at any time by deleting your account</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-slate-800 mb-2">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be reflected by the "Last updated" date at the top of this page. Continued use of the App after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-slate-800 mb-2">11. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us at: <a href="mailto:tinycloset@support.com" className="text-sky-500 underline">tinycloset@support.com</a>
          </p>
        </section>
      </div>
    </div>
  );
};
