import * as React from 'react';
import { Input } from '@/components/ui/input';

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const PhoneInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  ({ onChange, ...props }, ref) => {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      e.target.value = formatPhone(e.target.value);
      onChange?.(e);
    }

    return <Input ref={ref} type="tel" inputMode="numeric" {...props} onChange={handleChange} />;
  },
);
PhoneInput.displayName = 'PhoneInput';

export { PhoneInput };
