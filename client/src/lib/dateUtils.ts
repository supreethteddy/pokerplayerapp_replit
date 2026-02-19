const IST_TZ = 'Asia/Kolkata';

export const formatDateIST = (date: string | Date | null | undefined): string => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', {
    timeZone: IST_TZ, day: '2-digit', month: 'short', year: 'numeric',
  });
};

export const formatTimeIST = (date: string | Date | null | undefined): string => {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-IN', {
    timeZone: IST_TZ, hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

export const formatDateTimeIST = (date: string | Date | null | undefined): string => {
  if (!date) return '';
  return new Date(date).toLocaleString('en-IN', {
    timeZone: IST_TZ, day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

export const toLocaleIST = (date: string | Date | null | undefined, locale = 'en-IN', options: Intl.DateTimeFormatOptions = {}): string => {
  if (!date) return '';
  return new Date(date).toLocaleString(locale, { timeZone: IST_TZ, ...options });
};

export const toLocaleDateIST = (date: string | Date | null | undefined, locale = 'en-IN', options: Intl.DateTimeFormatOptions = {}): string => {
  if (!date) return '';
  return new Date(date).toLocaleDateString(locale, { timeZone: IST_TZ, ...options });
};

export const toLocaleTimeIST = (date: string | Date | null | undefined, locale = 'en-IN', options: Intl.DateTimeFormatOptions = {}): string => {
  if (!date) return '';
  return new Date(date).toLocaleTimeString(locale, { timeZone: IST_TZ, ...options });
};
