export default function BlockPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-2xl w-full mx-4">
        <div className="rounded-2xl bg-gradient-to-b from-red-500/10 to-red-900/10 border border-red-500/20 p-8 backdrop-blur-sm">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Cross Emoji */}
            <div className="text-8xl animate-pulse">❌</div>

            {/* Title */}
            <h1 className="text-4xl font-bold text-white">Access Restricted</h1>

            {/* Description */}
            <div className="space-y-4 text-gray-300">
              <p className="text-lg">
                We're sorry, but Turbo DA is not available in your country.
              </p>

              <p className="text-base">
                Due to legal and regulatory restrictions, we cannot provide our
                services to users from certain regions. This decision is made to
                ensure compliance with international laws and regulations.
              </p>

              <div className="mt-8 p-4 bg-red-950/30 rounded-lg border border-red-500/30">
                <p className="text-sm text-gray-400">
                  If you believe this is an error or have any questions, please
                  contact our support team.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
