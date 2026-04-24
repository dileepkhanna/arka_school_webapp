const TermsAndConditions = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms &amp; Conditions</h1>
        <p className="text-sm text-gray-500 mb-2">Smart Edu Connect</p>
        <p className="text-sm text-gray-600 mb-8">Effective Date: [Add Date]</p>

        <p className="mb-6 text-gray-700">
          By using Smart Edu Connect, you agree to the following terms:
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Usage</h2>
        <p className="mb-3 text-gray-700">This app is intended for:</p>
        <ul className="list-disc pl-6 mb-3 text-gray-700 space-y-1">
          <li>Schools</li>
          <li>Educational institutions</li>
          <li>Authorized staff, students, and parents</li>
        </ul>
        <p className="mb-6 text-gray-700">
          Public registration is not allowed. Accounts are created by administrators.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. User Responsibilities</h2>
        <p className="mb-3 text-gray-700">Users agree to:</p>
        <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-1">
          <li>Provide accurate information</li>
          <li>Keep login credentials secure</li>
          <li>Use the app only for educational purposes</li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Account Access</h2>
        <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-1">
          <li>Accounts are managed by school administrators</li>
          <li>Unauthorized access or misuse is strictly prohibited</li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Data Usage</h2>
        <p className="mb-3 text-gray-700">All data entered into the app:</p>
        <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-1">
          <li>Belongs to the respective institution</li>
          <li>Must be used only for educational and administrative purposes</li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Restrictions</h2>
        <p className="mb-3 text-gray-700">Users must NOT:</p>
        <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-1">
          <li>Attempt to hack or disrupt the system</li>
          <li>Misuse data of other users</li>
          <li>Use the app for illegal activities</li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Service Availability</h2>
        <p className="mb-6 text-gray-700">
          We aim to provide continuous service but do not guarantee uninterrupted access at all times.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Termination</h2>
        <p className="mb-3 text-gray-700">We reserve the right to:</p>
        <ul className="list-disc pl-6 mb-6 text-gray-700">
          <li>Suspend or terminate accounts in case of misuse</li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Limitation of Liability</h2>
        <p className="mb-3 text-gray-700">We are not responsible for:</p>
        <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-1">
          <li>Data loss due to user actions</li>
          <li>Unauthorized access caused by poor credential security</li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. Changes to Terms</h2>
        <p className="mb-6 text-gray-700">
          We may update these terms at any time. Continued use of the app means acceptance of updated terms.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. Contact</h2>
        <p className="mb-2 text-gray-700">For any questions:</p>
        <p className="mb-8 text-gray-700">
          <a href="mailto:info@asetechnologies.in" className="text-blue-600 hover:underline">
            info@asetechnologies.in
          </a>
        </p>
      </div>
    </div>
  );
};

export default TermsAndConditions;
