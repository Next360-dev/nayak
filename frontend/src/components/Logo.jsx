import React from 'react';

/** The product logo. One file (`public/logo.svg`); replace that file to change it everywhere. */
export default function Logo({ className = 'size-10' }) {
  return <img src="/logo.svg" alt="" aria-hidden="true" className={className} width="40" height="40" />;
}
