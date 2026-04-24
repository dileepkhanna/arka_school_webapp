const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-2">Smart Edu Connect</p>
        <p className="text-sm text-gray-600 mb-8">Effective Date: 22/04/2026</p>

        <p className="mb-6 text-gray-700">
          Smart Edu Connect ("we", "our", "app") is a school management application designed for use by authorized
          school administrators, teachers, students, and parents. This Privacy Policy explains how we collect, use,
          and protect user data.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Information We Collect</h2>

        <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">Personal Information</h3>
        <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-1">
          <li>Name</li>
          <li>Email address (optional)</li>
          <li>Phone number (if provided)</li>
          <li>Student ID or user ID</li>
        </ul>

        <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">Student Information</h3>
        <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-1">
          <li>Class details</li>
          <li>Attendance records</li>
          <li>Academic data (subjects, exams, reports)</li>
        </ul>

        <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">Media &amp; Files</h3>
        <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-1">
          <li>Student photos (profile images)</li>
          <li>Files such as CSV uploads for data management</li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. How We Use Information</h2>
        <p className="mb-3 text-gray-700">We use collected data to:</p>
        <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-1">
          <li>Create and manage user accounts</li>
          <li>Maintain student records</li>
          <li>Track attendance and academic performance</li>
          <li>Provide app functionality and features</li>
          <li>Improve app performance and user experience</li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Data Sharing</h2>
        <p className="mb-3 text-gray-700">
          We <strong>do not sell or share user data with third parties</strong>.
        </p>
        <p className="mb-3 text-gray-700">Data may only be accessed by:</p>
        <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-1">
          <li>Authorized school administrators</li>
          <li>Teachers within the same organization</li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Data Security</h2>
        <p className="mb-3 text-gray-700">We take appropriate security measures to protect user data:</p>
        <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-1">
          <li>Data is transmitted using secure protocols (HTTPS)</li>
          <li>Access is restricted to authorized users only</li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Data Retention</h2>
        <p className="mb-6 text-gray-700">
          We retain user data only as long as required for school operations or as instructed by the organization
          using the app.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Children's Privacy</h2>
        <p className="mb-6 text-gray-700">
          This app is intended for use by schools and educational institutions. Student data is managed by
          authorized school personnel.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. User Control</h2>
        <p className="mb-3 text-gray-700">Since accounts are created by administrators:</p>
        <ul className="list-disc pl-6 mb-6 text-gray-700">
          <li>Users should contact their school/admin for data updates or deletion requests</li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Changes to This Policy</h2>
        <p className="mb-6 text-gray-700">
          We may update this Privacy Policy from time to time. Updates will be reflected within the app or
          associated platforms.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. Contact Us</h2>
        <p className="mb-2 text-gray-700">If you have any questions, contact us at:</p>
        <p className="mb-8 text-gray-700">
          <a href="mailto:info@asetechnologies.in" className="text-blue-600 hover:underline">
            info@asetechnologies.in
          </a>
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
