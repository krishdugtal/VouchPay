'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Close mobile drawer on route change or resize
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 720) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
  }, [isMenuOpen]);

  const navLinks = [
    { label: 'About', href: '/#product' },
    { label: 'Catalog Setup', href: '/catalog-setup' },
    { label: 'AI Chat', href: '/chat' },
    { label: 'Audit Trail', href: '/audit-trail' },
    { label: 'Analytics', href: '/analytics' },
    { label: 'Docs', href: '/docs' },
    { label: 'Working', href: '/#how-it-works' },
  ];

  const isActive = (href: string) => {
    if (href === '/' || href.startsWith('/#')) {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      <header className="header sticky top-0 z-50 pt-4 px-4 sm:px-6 w-full flex justify-center">
        <div className="w-full max-w-[900px] flex items-center justify-between sm:justify-center gap-3 sm:gap-6">
          
          {/* Circular Logo Button */}
          <Link href="/" className="logo-btn" aria-label="Home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo.webp" alt="VouchPay Logo" width="52" height="52" />
          </Link>

          {/* Desktop Nav Pill (White) */}
          <nav className="nav-pill hidden sm:flex" aria-label="Main Navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${isActive(link.href) ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA Button ("Get Started" -> /demo) */}
          <Link href="/demo" className="sign-in-btn hidden sm:flex">
            Get Started
          </Link>

          {/* Mobile Burger Button */}
          <button
            className="mobile-burger sm:hidden"
            aria-label="Toggle Menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <div className="mobile-burger-bars">
              <span className="mobile-burger-bar"></span>
              <span className="mobile-burger-bar"></span>
              <span className="mobile-burger-bar"></span>
            </div>
          </button>

        </div>
      </header>

      {/* Mobile Navigation Drawer Sheet & Backdrop Overlay */}
      <div className="mobile-overlay" onClick={() => setIsMenuOpen(false)}></div>
      <div className="mobile-menu-sheet">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`mobile-nav-link ${isActive(link.href) ? 'active' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          >
            {link.label}
          </Link>
        ))}
        <Link href="/demo" className="mobile-sign-in" onClick={() => setIsMenuOpen(false)}>
          Get Started
        </Link>
      </div>
    </>
  );
}
