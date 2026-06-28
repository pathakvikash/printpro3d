import Link from 'next/link';
import HeroScene from '@/components/HeroScene';

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-gray-950">
        <HeroScene />
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 w-full">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium mb-8">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              Professional 3D Printing Service
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight">
              Your Vision,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">
                Printed in 3D
              </span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-400 leading-relaxed max-w-lg">
              Upload your 3D models, choose from premium materials, and get high-quality prints delivered to your doorstep.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/upload"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-lg transition-all duration-300 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
              >
                Upload Your Model
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="/materials"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-semibold text-lg transition-all duration-300"
              >
                View Materials
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
          <span className="text-gray-500 text-xs font-medium uppercase tracking-widest">Scroll</span>
          <div className="w-5 h-8 rounded-full border-2 border-gray-700 flex justify-center pt-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-12 bg-gray-50 dark:bg-gray-900 border-y border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { number: '10,000+', label: 'Prints Delivered' },
              { number: '50+', label: 'Premium Materials' },
              { number: '2-Day', label: 'Avg. Turnaround' },
              { number: '99%', label: 'Satisfaction Rate' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{stat.number}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What We Offer */}
      <section className="py-24 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-indigo-600 dark:text-indigo-400 font-semibold text-sm uppercase tracking-wider">What We Offer</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              End-to-End 3D Printing Services
            </h2>
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              From prototyping to production, we handle every step of the 3D printing process with precision and care.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: '3D Printing',
                desc: 'High-resolution FDM, SLA, and SLS printing for prototypes and end-use parts.',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76a1 1 0 000 1.4z" />
                ),
              },
              {
                title: 'Rapid Prototyping',
                desc: 'Fast iteration cycles with quick turnaround to accelerate your product development.',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                ),
              },
              {
                title: 'Custom Finishing',
                desc: 'Sanding, priming, painting, and post-processing for a flawless professional finish.',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                ),
              },
              {
                title: 'Bulk Production',
                desc: 'Scalable manufacturing with consistent quality for low to medium volume production runs.',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                ),
              },
            ].map((service) => (
              <div
                key={service.title}
                className="group relative p-8 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {service.icon}
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{service.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-indigo-600 dark:text-indigo-400 font-semibold text-sm uppercase tracking-wider">How It Works</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              From Design to Doorstep in 4 Steps
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {[
              { step: '01', title: 'Upload', desc: 'Upload your 3D model in STL, OBJ, or GLB format.' },
              { step: '02', title: 'Customize', desc: 'Choose material, color, finish, and infill settings.' },
              { step: '03', title: 'Quote & Pay', desc: 'Get an instant price and pay securely online.' },
              { step: '04', title: 'We Deliver', desc: 'We print, finish, and ship your order to your door.' },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center mb-5">
                    <span className="text-white text-xl font-bold">{item.step}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Materials Preview */}
      <section className="py-24 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-indigo-600 dark:text-indigo-400 font-semibold text-sm uppercase tracking-wider">Premium Materials</p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
                50+ Materials & Finishes
              </h2>
              <p className="mt-4 text-gray-500 dark:text-gray-400 leading-relaxed">
                From standard PLA to engineering-grade Nylon, carbon fiber composites, and flexible TPU. Choose from a wide range of colors and post-processing finishes to get exactly the look and feel you need.
              </p>
              <Link
                href="/materials"
                className="mt-8 inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                Explore All Materials
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: 'PLA+', color: 'from-emerald-400 to-emerald-600' },
                { name: 'ABS', color: 'from-blue-400 to-blue-600' },
                { name: 'PETG', color: 'from-cyan-400 to-cyan-600' },
                { name: 'Nylon', color: 'from-amber-400 to-amber-600' },
                { name: 'TPU', color: 'from-rose-400 to-rose-600' },
                { name: 'Carbon Fiber', color: 'from-gray-400 to-gray-600' },
              ].map((mat) => (
                <div
                  key={mat.name}
                  className="relative p-6 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 group cursor-default"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${mat.color} opacity-10 dark:opacity-20 group-hover:opacity-20 dark:group-hover:opacity-30 transition-opacity`} />
                  <p className="relative font-semibold text-gray-900 dark:text-white">{mat.name}</p>
                  <p className="relative text-sm text-gray-500 dark:text-gray-400 mt-1">Premium quality</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-r from-indigo-600 to-indigo-500">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Ready to Bring Your Ideas to Life?
          </h2>
          <p className="mt-4 text-lg text-indigo-100">
            Upload your 3D model and get a free instant quote. No account required.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/upload"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white text-indigo-600 font-semibold text-lg hover:bg-indigo-50 transition-all duration-300 shadow-xl"
            >
              Get Started Free
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/materials"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border-2 border-white/30 text-white font-semibold text-lg hover:bg-white/10 transition-all duration-300"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
