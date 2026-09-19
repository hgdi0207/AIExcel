import Link from 'next/link';

export default function LandingPage() {
  const tools = [
    {
      id: 'formulas',
      name: 'Formulas',
      icon: '📊',
      description: 'Generate Excel and Google Sheets formulas',
      href: '/formulas',
    },
    {
      id: 'scripts',
      name: 'Scripts',
      icon: '📝',
      description: 'VBA and Apps Script automation',
      href: '/scripts',
    },
    {
      id: 'sql',
      name: 'SQL',
      icon: '🗄️',
      description: 'Generate and understand SQL queries',
      href: '/sql',
    },
    {
      id: 'regex',
      name: 'Regex',
      icon: '🔍',
      description: 'Create regex patterns for data validation',
      href: '/regex',
    },
    {
      id: 'pivot-builder',
      name: 'Pivot Builder',
      icon: '📋',
      description: 'Build pivot tables with AI',
      href: '/pivot-builder',
      badge: 'New',
    },
    {
      id: 'assistant',
      name: 'AI Chat',
      icon: '💬',
      description: 'Spreadsheet assistant chatbot',
      href: '/assistant',
    },
    {
      id: 'data-analysis',
      name: 'Data Analysis',
      icon: '📈',
      description: 'Analyze and visualize your data',
      href: '/data-analysis',
    },
    {
      id: 'reports',
      name: 'Reports',
      icon: '📄',
      description: 'Generate comprehensive reports',
      href: '/reports',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-border-gray">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-green rounded-md flex items-center justify-center text-white font-bold">
              📊
            </div>
            <span className="text-xl font-semibold text-text-primary">GPTEXCEL</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-text-secondary">
            <a href="#pricing" className="hover:text-brand-green transition">Pricing</a>
            <a href="#tools" className="hover:text-brand-green transition">Features</a>
          </nav>

          <Link
            href="/login"
            className="bg-text-primary text-white px-6 py-2.5 rounded-sm hover:bg-opacity-90 transition text-sm font-medium"
          >
            Login
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-4 text-sm text-brand-green font-medium">
            ⚡ 40M+ formulas generated, so far
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-text-primary mb-6 leading-tight">
            AI-Powered <span className="bg-gradient-to-r from-brand-green via-cyan-400 to-purple-400 bg-clip-text text-transparent">Spreadsheet Automation</span>: Formulas, Pivot-Tables, Charts & Data Insights.
          </h1>

          <p className="text-lg text-text-secondary mb-8 max-w-2xl mx-auto leading-relaxed">
            From generating complex formulas and Pivot Tables to creating charts and uncovering deep insights, streamline your spreadsheets with AI.
          </p>

          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-10 h-10 rounded-full bg-gray-300 border-2 border-white" />
              ))}
            </div>
            <span className="text-sm text-text-secondary">
              <span className="font-semibold text-brand-green">1.6 Million+</span> Happy users
            </span>
          </div>

          <a
            href="#tools"
            className="inline-flex items-center gap-2 bg-text-primary text-white px-8 py-4 rounded-full hover:bg-opacity-90 transition text-base font-medium"
          >
            GET STARTED →
          </a>
        </div>

        {/* Decorative elements */}
        <svg className="absolute top-32 left-10 w-32 h-32 text-brand-green opacity-20" viewBox="0 0 100 100">
          <path d="M10,50 Q30,20 50,50 T90,50" stroke="currentColor" strokeWidth="3" fill="none" />
        </svg>
        <svg className="absolute top-20 right-10 w-40 h-40 text-orange-400 opacity-20" viewBox="0 0 100 100">
          <path d="M20,30 Q40,10 60,30 T100,30" stroke="currentColor" strokeWidth="3" fill="none" />
        </svg>
      </section>

      {/* Tools Grid */}
      <section id="tools" className="py-16 px-6 bg-bg-gray">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text-primary mb-4">Powerful AI Tools</h2>
            <p className="text-text-secondary">Choose a tool to get started - no login required for trial</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {tools.map((tool) => (
              <Link
                key={tool.id}
                href={tool.href}
                className="group relative bg-white border border-border-gray rounded-md p-6 hover:bg-brand-green hover:border-brand-green transition-all duration-300 hover:-translate-y-1 hover:shadow-card"
              >
                {tool.badge && (
                  <span className="absolute top-3 right-3 bg-brand-green text-white text-xs px-2 py-1 rounded-full group-hover:bg-white group-hover:text-brand-green">
                    {tool.badge}
                  </span>
                )}

                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                  {tool.icon}
                </div>

                <h3 className="text-lg font-semibold text-text-primary mb-2 group-hover:text-white">
                  {tool.name}
                </h3>

                <p className="text-sm text-text-secondary group-hover:text-white/90">
                  {tool.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text-primary mb-4">See It In Action</h2>
            <p className="text-text-secondary">AI-powered spreadsheet automation at your fingertips</p>
          </div>

          <div className="bg-bg-gray rounded-lg p-8">
            {/* Browser Window Mockup */}
            <div className="bg-white rounded-lg shadow-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 border-b border-border-gray">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                <span className="ml-4 text-xs text-text-secondary">Spreadsheet Assistant</span>
              </div>

              <div className="p-8">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 bg-brand-green rounded-full flex items-center justify-center text-white text-xs">
                    AI
                  </div>
                  <div className="flex-1 bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-text-primary mb-2">
                      How to do a case-sensitive lookup using <code className="bg-white px-2 py-1 rounded text-xs">INDEX/MATCH + EXACT</code> (array formula) in A2:B200
                    </p>
                    <div className="bg-white rounded p-3 mt-3">
                      <code className="text-xs font-mono text-brand-green">
                        =INDEX($B$2:$B$200, MATCH(TRUE, EXACT($A$2:$A$200, lookup_value), 0))
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 px-6 bg-bg-gray">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text-primary mb-4">Simple, Transparent Pricing</h2>
            <p className="text-text-secondary">Start for free, upgrade when you need more</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Free Plan */}
            <div className="bg-white rounded-lg p-8 border-2 border-border-gray">
              <h3 className="text-2xl font-bold text-text-primary mb-2">Free</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-text-primary">$0</span>
                <span className="text-text-secondary">/month</span>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <span className="text-brand-green">✓</span>
                  <span className="text-text-secondary">10 AI chat messages/month</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand-green">✓</span>
                  <span className="text-text-secondary">4 tool uses every 12 hours</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-gray-300">✗</span>
                  <span className="text-text-secondary">Priority support</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-gray-300">✗</span>
                  <span className="text-text-secondary">File upload</span>
                </li>
              </ul>

              <Link
                href="/formulas"
                className="block w-full text-center bg-bg-gray text-text-primary py-3 rounded-md font-medium hover:bg-gray-200 transition"
              >
                Get Started
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-lg p-8 border-2 border-brand-green relative">
              <div className="absolute top-0 right-8 -translate-y-1/2 bg-brand-green text-white text-xs px-3 py-1 rounded-full">
                POPULAR
              </div>

              <h3 className="text-2xl font-bold text-text-primary mb-2">Pro</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-text-primary">$9</span>
                <span className="text-text-secondary">/month</span>
                <div className="text-sm text-brand-green mt-1">120 credits every month</div>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <span className="text-brand-green">✓</span>
                  <span className="text-text-secondary">120 monthly credits</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand-green">✓</span>
                  <span className="text-text-secondary">Up to 50MB file uploads</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand-green">✓</span>
                  <span className="text-text-secondary">Priority AI processing</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand-green">✓</span>
                  <span className="text-text-secondary">File upload & analysis</span>
                </li>
              </ul>

              <Link
                href="/login"
                className="block w-full text-center bg-brand-green text-white py-3 rounded-md font-medium hover:bg-brand-green-dark transition"
              >
                Upgrade to Pro
              </Link>
            </div>

            {/* Pro Plus Plan */}
            <div className="bg-white rounded-lg p-8 border-2 border-border-gray relative">
              <h3 className="text-2xl font-bold text-text-primary mb-2">Pro Plus</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-text-primary">$18</span>
                <span className="text-text-secondary">/month</span>
                <div className="text-sm text-brand-green mt-1">300 credits every month</div>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <span className="text-brand-green">&#10003;</span>
                  <span className="text-text-secondary">300 monthly credits</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand-green">&#10003;</span>
                  <span className="text-text-secondary">Up to 100MB file uploads</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand-green">&#10003;</span>
                  <span className="text-text-secondary">Priority AI processing</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand-green">&#10003;</span>
                  <span className="text-text-secondary">Heavy analysis and reporting</span>
                </li>
              </ul>

              <Link
                href="/login"
                className="block w-full text-center bg-text-primary text-white py-3 rounded-md font-medium hover:bg-opacity-90 transition"
              >
                Upgrade to Pro Plus
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-gray py-8 px-6">
        <div className="max-w-6xl mx-auto text-center text-sm text-text-secondary">
          <p>© 2026 GPTEXCEL. AI-powered spreadsheet automation.</p>
        </div>
      </footer>
    </div>
  );
}
