// Entirely fictional fixtures. Never describe these as verified providers or networks.
export const conditions = ['Hashimoto’s thyroiditis', 'Rheumatoid arthritis', 'Lupus (SLE)', 'Celiac disease', 'Psoriasis / Psoriatic arthritis', 'Multiple sclerosis', 'Type 1 diabetes', 'Sjögren’s syndrome', 'Crohn’s disease', 'Ulcerative colitis', 'Still figuring it out'];
export const insurers = ['Aetna', 'Blue Cross Blue Shield', 'Cigna', 'UnitedHealthcare', 'Other / not sure', 'Uninsured / self-pay'];
export const locations = {
  denver: { label: 'Denver, CO', zip: '80202' },
  slc: { label: 'Salt Lake City, UT', zip: '84101' },
  phoenix: { label: 'Phoenix, AZ', zip: '85001' },
};
const rows = [
  ['maya', 'Maya Chen', 'MC', 'Rheumatology', ['Rheumatoid arthritis', 'Lupus'], ['Aetna', 'Cigna'], 2.4, 7, 'A thoughtful place to begin your specialist search.', 'sage'],
  ['sarah', 'Sarah Williams', 'SW', 'Rheumatology', ['Rheumatoid arthritis', 'Lupus'], ['Aetna', 'Blue Cross Blue Shield'], 4.8, 14, 'Coordinated visits and time for your questions.', 'peach'],
  ['elena', 'Elena Rivera', 'ER', 'Primary care', conditions, ['Aetna', 'UnitedHealthcare', 'Blue Cross Blue Shield'], 1.6, 3, 'A starting point for referrals and care coordination.', 'lilac'],
  ['priya', 'Priya Patel', 'PP', 'Gastroenterology', ['Celiac disease'], ['Cigna', 'Blue Cross Blue Shield'], 6.2, 10, 'Space to discuss digestive health and next steps.', 'sand'],
  ['jordan', 'Jordan Brooks', 'JB', 'Endocrinology', ['Hashimoto’s thyroiditis'], ['Aetna', 'UnitedHealthcare'], 8.1, 21, 'Support for navigating thyroid care appointments.', 'sage'],
  ['nora', 'Nora Thompson', 'NT', 'Rheumatology', ['Rheumatoid arthritis', 'Lupus'], ['Cigna', 'UnitedHealthcare'], 12.5, 28, 'Another specialist option to explore at your pace.', 'lilac'],
];
export const providers = rows.map(([id, name, initials, specialty, conditions, plans, miles, days, description, color], i) => ({ id, name, initials, specialty, conditions, plans, miles, days, description, color, phone: `+1202555010${i}` }));
export const resources = [
  { title: 'Understanding autoimmune diseases', source: 'NIH · NIAMS', topic: 'The basics', condition: null, url: 'https://www.niams.nih.gov/health-topics/autoimmune-diseases', text: 'A clear starting point for learning about autoimmune conditions.' },
  { title: 'Getting to know rheumatoid arthritis', source: 'NIH · NIAMS', topic: 'Your diagnosis', condition: 'Rheumatoid arthritis', url: 'https://www.niams.nih.gov/health-topics/rheumatoid-arthritis', text: 'An overview of rheumatoid arthritis, with links to diagnosis and care information.' },
  { title: 'Understanding lupus', source: 'NIH · NIAMS', topic: 'Your diagnosis', condition: 'Lupus', url: 'https://www.niams.nih.gov/health-topics/lupus', text: 'Learn about lupus from a public health research organization.' },
  { title: 'A guide to celiac disease', source: 'NIH · NIDDK', topic: 'Your diagnosis', condition: 'Celiac disease', url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/celiac-disease', text: 'An introduction to celiac disease and topics to discuss with your care team.' },
  { title: 'Understanding Hashimoto’s disease', source: 'NIH · NIDDK', topic: 'Your diagnosis', condition: 'Hashimoto’s thyroiditis', url: 'https://www.niddk.nih.gov/health-information/endocrine-diseases/hashimotos-disease', text: 'Information about Hashimoto’s disease from NIDDK.' },
];
export const demoProfile = { conditions: [conditions[0]], insurance: 'Aetna', location: 'denver' };
