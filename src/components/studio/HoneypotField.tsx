'use client';

import { useState } from 'react';

export default function HoneypotField() {
  const [value, setValue] = useState('');

  return (
    <input
      type="text"
      name="website"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
    />
  );
}
