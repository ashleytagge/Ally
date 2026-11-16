import { providers, conditions, insurers, locations } from './data.js';
export const initialFilters = () => ({ query: '', specialty: '', network: false, distance: '50', availability: 'any', sort: 'relevance' });
export function networkLabel(provider, profile) {
  if (!profile || !insurers.slice(0, 4).includes(profile.insurance)) return 'Coverage unknown';
  return provider.plans.includes(profile.insurance) ? 'Sample plan match' : 'No sample plan match';
}
export function distance(provider, profile) {
  return Number((provider.miles * ({ denver: 1, slc: 1.2, phoenix: 1.5 }[profile?.location] || 1)).toFixed(1));
}
export function findProviders(profile, filters, savedOnly = null) {
  return providers.filter(p => !savedOnly || savedOnly.includes(p.id))
    .filter(p => p.conditions.includes(profile.condition))
    .filter(p => `${p.name} ${p.specialty}`.toLowerCase().includes(filters.query.trim().toLowerCase()))
    .filter(p => !filters.specialty || p.specialty === filters.specialty)
    .filter(p => !filters.network || networkLabel(p, profile) === 'Sample plan match')
    .filter(p => distance(p, profile) <= Number(filters.distance))
    .filter(p => filters.availability === 'any' || p.days <= Number(filters.availability))
    .sort((a, b) => filters.sort === 'distance' ? distance(a, profile) - distance(b, profile) : filters.sort === 'availability' ? a.days - b.days : Number(b.plans.includes(profile.insurance)) - Number(a.plans.includes(profile.insurance)) || a.days - b.days);
}
export function validProfile(p) { return !!p && conditions.includes(p.condition) && insurers.includes(p.insurance) && Object.hasOwn(locations, p.location); }
// Session-only storage avoids retaining diagnosis/insurance after the browser session.
export function readState(storage) {
  try {
    const data = JSON.parse(storage.getItem('ally-session-v1'));
    return { profile: validProfile(data?.profile) ? data.profile : null, saved: Array.isArray(data?.saved) ? data.saved.filter(id => providers.some(p => p.id === id)) : [], appointments: Array.isArray(data?.appointments) ? data.appointments.filter(a => providers.some(p => p.id === a.id) && typeof a.date === 'string' && typeof a.time === 'string') : [], tasks: Array.isArray(data?.tasks) ? data.tasks.filter(t => ['coverage', 'questions', 'records'].includes(t)) : [] };
  } catch { return { profile: null, saved: [], appointments: [], tasks: [] }; }
}
