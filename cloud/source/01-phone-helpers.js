function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function phoneVariants(phone) {
  const digits = digitsOnly(phone);
  const variants = new Set();
  if (!digits) return [];

  variants.add(digits);
  if (digits.length === 13 && digits.startsWith('55')) {
    variants.add(digits.slice(2));
  }
  if (digits.length === 11) {
    variants.add('55' + digits);
    if (digits[2] === '9') {
      variants.add(digits.slice(0, 2) + digits.slice(3));
    }
  }
  if (digits.startsWith('55') && digits.length >= 12) {
    variants.add(digits.slice(2));
  }
  if (digits.length === 10) {
    variants.add('55' + digits);
    variants.add(digits.slice(0, 2) + '9' + digits.slice(2));
  }
  return Array.from(variants);
}

function digitsMatch(input, stored) {
  const inputVariants = new Set(phoneVariants(input));
  for (const variant of phoneVariants(stored)) {
    if (inputVariants.has(variant)) {
      return true;
    }
  }
  return false;
}
