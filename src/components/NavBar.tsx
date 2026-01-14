'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/shows', label: 'My Shows', icon: '📺' },
  { href: '/recommendations', label: 'Recs', icon: '✨' },
  { href: '/preferences', label: 'Prefs', icon: '⚙️' },
  { href: '/add', label: 'Add', icon: '➕' },
  { href: '/settings', label: 'Settings', icon: '🔧' }
];

export default function NavBar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between h-12 sm:h-14">
          {/* Logo */}
          <Link href="/" className="text-lg sm:text-xl font-bold text-white">
            TV Tracker
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Mobile Navigation - Compact horizontal */}
          <div className="flex md:hidden gap-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <span className="hidden xs:inline">{item.label}</span>
                  <span className="xs:hidden">{item.icon}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
