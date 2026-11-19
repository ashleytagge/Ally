import { providers, conditions, insurers, locations } from './data.js';
export const initialFilters = () => ({ query: '', inNetwork: false, distance: 'any', sort: 'relevance' });
export function networkLabel(provider, profile) {
  if (!profile || !insurers.slice(0, 4).includes(profile.insurance)) return 'Coverage unknown';
  return provider.plans.includes(profile.insurance) ? 'Sample plan match' : 'No sample plan match';
}
export function distance(provider, profile) {
  return Number((provider.miles * ({ denver: 1, slc: 1.2, phoenix: 1.5 }[profile?.location] || 1)).toFixed(1));
}
export function findProviders(profile, filters, savedOnly = null) {
  const condition = profile.condition || (Array.isArray(profile.conditions) ? profile.conditions[0] : null);
  const networkOnly = filters.network ?? filters.inNetwork;
  const distanceLimit = filters.distance === 'any' ? Infinity : Number(filters.distance);
  const availabilityLimit = filters.availability === 'any' ? Infinity : Number(filters.availability);
  return providers.filter(p => !savedOnly || savedOnly.includes(p.id))
    .filter(p => condition ? p.conditions.includes(condition) : false)
    .filter(p => `${p.name} ${p.specialty}`.toLowerCase().includes(filters.query.trim().toLowerCase()))
    .filter(p => !filters.specialty || p.specialty === filters.specialty)
    .filter(p => !networkOnly || networkLabel(p, profile) === 'Sample plan match')
    .filter(p => Number.isFinite(distanceLimit) ? distance(p, profile) <= distanceLimit : true)
    .filter(p => Number.isFinite(availabilityLimit) ? p.days <= availabilityLimit : true)
    .sort((a, b) => filters.sort === 'distance' ? distance(a, profile) - distance(b, profile) : filters.sort === 'availability' ? a.days - b.days : Number(b.plans.includes(profile.insurance)) - Number(a.plans.includes(profile.insurance)) || a.days - b.days);
}
export function validProfile(p) { if (!p) return false; const conds = Array.isArray(p.conditions) ? p.conditions : (p.condition ? [p.condition] : []); return conds.length > 0 && conds.every(c => conditions.includes(c)) && insurers.includes(p.insurance) && Object.hasOwn(locations, p.location); }
// Session-only storage avoids retaining diagnosis/insurance after the browser session.
const DEFAULT_PROVIDERS = [
  { id: 'default-prov-1', name: 'Dr. Linda Rawson, MD', office: 'Holladay Family Medicine', specialty: 'Primary Care', isCurrent: true, inNetwork: true },
  { id: 'default-prov-2', name: 'Dr. Elena Christofides, MD', office: 'Utah Endocrinology Associates', specialty: 'Endocrinologist', isCurrent: true, inNetwork: true },
];
const DEFAULT_SYMPTOMS = [
  { id: 'default-sym-1', name: 'Fatigue', severity: 2 },
  { id: 'default-sym-2', name: 'Hair thinning', severity: 3 },
  { id: 'default-sym-3', name: 'Weight gain', severity: 2 },
];
const DEFAULT_TREATMENTS = [
  { id: 'default-treat-1', name: 'Levothyroxine', type: 'Medication', status: 'working', sideEffects: false },
  { id: 'default-treat-2', name: 'Gluten-free diet', type: 'Lifestyle', status: 'unknown', sideEffects: false },
];

export function readState(storage) {
  try {
    const data = JSON.parse(storage.getItem('ally-session-v1'));
    return { profile: validProfile(data?.profile) ? data.profile : null, saved: Array.isArray(data?.saved) ? data.saved.filter(id => providers.some(p => p.id === id)) : [], appointments: Array.isArray(data?.appointments) ? data.appointments.filter(a => providers.some(p => p.id === a.id) && typeof a.date === 'string' && typeof a.time === 'string') : [], tasks: Array.isArray(data?.tasks) ? data.tasks.filter(t => ['coverage', 'questions', 'records'].includes(t)) : [], myProviders: Array.isArray(data?.myProviders) ? data.myProviders : [...DEFAULT_PROVIDERS], symptoms: Array.isArray(data?.symptoms) ? data.symptoms : [...DEFAULT_SYMPTOMS], treatments: Array.isArray(data?.treatments) ? data.treatments : [...DEFAULT_TREATMENTS] };
  } catch { return { profile: null, saved: [], appointments: [], tasks: [], myProviders: [...DEFAULT_PROVIDERS], symptoms: [...DEFAULT_SYMPTOMS], treatments: [...DEFAULT_TREATMENTS] }; }
}
