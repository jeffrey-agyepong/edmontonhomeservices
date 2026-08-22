import { config, fields, collection } from '@keystatic/core';

/*
 * Mirrors src/content.config.ts field-for-field. Both must stay in sync —
 * this is the editing UI, that's what actually validates/renders the site.
 *
 * `slug` on every collection uses fields.text() rather than fields.slug():
 * fields.slug() stores a compound { name, slug } object under one key, which
 * doesn't match the flat `slug: string` the site's schema expects. A plain
 * text field is still a valid slugField in Keystatic (it satisfies the same
 * TypeScript constraint) and keeps the on-disk JSON flat.
 */
export default config({
  storage: { kind: 'local' },
  collections: {
    listings: collection({
      label: 'Listings',
      slugField: 'slug',
      path: 'src/content/listings/*',
      format: { data: 'json' },
      columns: ['name', 'category', 'phone'],
      schema: {
        name: fields.text({ label: 'Company Name', validation: { isRequired: true } }),
        slug: fields.text({ label: 'Slug', validation: { isRequired: true } }),
        category: fields.relationship({ label: 'Category', collection: 'categories' }),
        neighborhood: fields.text({ label: 'Neighborhood / service area' }),
        phone: fields.text({ label: 'Phone' }),
        website: fields.url({ label: 'Website', validation: { isRequired: true } }),
        description: fields.text({ label: 'Description', multiline: true }),
        photo: fields.text({ label: 'Photo URL' }),
        gallery: fields.array(
          fields.url({ label: 'Photo URL', validation: { isRequired: true } }),
          {
            label: 'Gallery photos (premium)',
            description: 'Shown on the listing page in place of the placeholder gallery. Leave empty to use the auto-generated placeholder.',
            itemLabel: (props) => props.value || 'Photo',
          },
        ),
        hours: fields.text({ label: 'Hours' }),
        years_in_business: fields.number({ label: 'Years in business' }),
        licensed_insured: fields.checkbox({ label: 'Licensed & insured (self-reported)' }),
        address: fields.text({ label: 'Address (or service area if no storefront)' }),
        latitude: fields.number({ label: 'Latitude', step: 0.000001 }),
        longitude: fields.number({ label: 'Longitude', step: 0.000001 }),
        services: fields.array(fields.text({ label: 'Service' }), {
          label: 'Services (3-6)',
          itemLabel: (props) => props.value || 'Service',
        }),
        premium: fields.checkbox({
          label: 'Premium listing',
          description: 'Unlocks the photo gallery and quote-request form on the listing page.',
        }),
        sponsored: fields.checkbox({
          label: 'Sponsored',
          description: 'Shows this listing in the "Local Spotlight" section on the homepage.',
        }),
        google_rating: fields.number({
          label: 'Google rating',
          description: 'A manually looked-up snapshot (0-5) of the business\'s real public Google rating — not live-synced. Leave blank if unverified.',
          step: 0.1,
        }),
        google_review_count: fields.number({
          label: 'Google review count',
          description: 'Review count at the time the rating above was looked up.',
        }),
      },
    }),
    categories: collection({
      label: 'Categories',
      slugField: 'slug',
      path: 'src/content/categories/*',
      format: { data: 'json' },
      schema: {
        name: fields.text({ label: 'Name', validation: { isRequired: true } }),
        slug: fields.text({ label: 'Slug', validation: { isRequired: true } }),
        description: fields.text({ label: 'Description', multiline: true }),
        icon: fields.text({ label: 'Icon (inline SVG)', multiline: true }),
        order: fields.number({ label: 'Order', defaultValue: 0 }),
      },
    }),
    pages: collection({
      label: 'Pages',
      slugField: 'slug',
      path: 'src/content/pages/*',
      format: { data: 'json' },
      schema: {
        title: fields.text({ label: 'Title', validation: { isRequired: true } }),
        slug: fields.text({ label: 'Slug', validation: { isRequired: true } }),
        body: fields.text({ label: 'Body (trusted HTML)', multiline: true }),
        inFooter: fields.checkbox({ label: 'Show in footer', defaultValue: true }),
        order: fields.number({ label: 'Order', defaultValue: 0 }),
      },
    }),
  },
});
