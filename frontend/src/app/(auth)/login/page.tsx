export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Black Brand Area */}
      <div className="hidden lg:flex lg:w-1/2 bg-black relative overflow-hidden">
        <div className="relative z-10 p-12 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-white">
            <div className="w-8 h-8 bg-brand-green rounded-md flex items-center justify-center font-bold">
              📊
            </div>
            <span className="text-xl font-semibold">GPTEXCEL</span>
          </div>

          <div className="text-white">
            <h2 className="text-4xl font-bold mb-4">
              Automate Your Spreadsheets with AI
            </h2>
            <p className="text-gray-400 text-lg">
              Join 1.6M+ users streamlining their workflow
            </p>
          </div>
        </div>

        {/* Decorative Elements */}
        <svg className="absolute top-20 right-20 w-64 h-64 text-brand-green opacity-20" viewBox="0 0 100 100">
          <path d="M10,50 Q30,20 50,50 T90,50" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
        <svg className="absolute bottom-20 left-20 w-48 h-48 text-purple-500 opacity-20" viewBox="0 0 100 100">
          <path d="M20,30 Q40,10 60,30 T100,30" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </div>

      {/* Right Panel - Form Area */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <a href="/" className="text-text-secondary hover:text-text-primary transition text-sm flex items-center gap-2 mb-8">
              ← Back to Home
            </a>

            <h1 className="text-3xl font-bold text-text-primary mb-2">Login</h1>
            <p className="text-text-secondary">Enter your email below to login to your account</p>
          </div>

          <form className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="name@example.com"
                className="w-full px-4 py-3 border border-border-gray rounded-md focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-text-primary text-white py-3 rounded-md font-medium hover:bg-opacity-90 transition"
            >
              Sign in with Email
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border-gray"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-text-secondary">OR CONTINUE WITH</span>
              </div>
            </div>

            <a
              href="/api/auth/google"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-border-gray rounded-md hover:bg-bg-gray transition"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </a>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            By continuing, you agree to our{' '}
            <a href="/terms" className="underline hover:text-text-primary">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="underline hover:text-text-primary">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
