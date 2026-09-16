// app/privacy/page.tsx (Next.js App Router)
import React from "react"

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>

      <p className="mb-4">
        At Platoo, your privacy is important to us. This Privacy Policy explains how we collect,
        use, and protect your personal information when you use our website and services.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">1. Information We Collect</h2>
      <p className="mb-4">
        We may collect personal information such as your name, email address, phone number,
        address, and payment details when you register, place orders, or contact us.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">2. How We Use Your Information</h2>
      <div className="mb-4">
        <ul className="list-disc list-inside ml-4">
          <li>Process and deliver your food orders</li>
          <li>Communicate order updates and promotions</li>
          <li>Improve our services and user experience</li>
        </ul>
      </div>

      <h2 className="text-xl font-semibold mt-6 mb-2">3. Data Protection</h2>
      <p className="mb-4">
        We implement security measures to protect your data. Your payment information is encrypted
        and handled by trusted third-party payment providers.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">4. Sharing Your Information</h2>
      <p className="mb-4">
        We do not sell or share your personal information with third parties, except as required
        for order fulfillment, legal compliance, or with your consent.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">5. Your Rights</h2>
      <p className="mb-4">
        You have the right to access, update, or delete your personal information. Contact us at
        support@platoo.com for assistance.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">6. Changes to This Policy</h2>
      <p className="mb-4">
        We may update this Privacy Policy from time to time. Changes will be posted on this page.
      </p>

      <p className="mt-6">
        If you have any questions or concerns, please contact us at{" "}
        <a href="mailto:support@platoo.com" className="text-blue-600 underline">
          support@platoo.com
        </a>
        .
      </p>
    </main>
  )
}
