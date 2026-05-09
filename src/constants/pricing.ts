export const pricingItems = [
    {
      plan: 'Free',
      tagline: 'For small size use-cases.',
      price: 0, // ₹0
      quota: 10,
      features: [
        { text: '5 pages per PDF', footnote: 'The maximum amount of pages per PDF-file.' },
        { text: '4MB file size limit', footnote: 'The maximum file size of a single PDF file.' },
        { text: 'Mobile-friendly interface' },
        { text: 'Higher-quality conversion', footnote: 'Resource-intensive processing for enhanced content quality', negative: true },
        { text: 'Multilingual support', negative: true },
      ],
    },
    {
      plan: 'Pro',
      tagline: 'For larger projects with higher needs.',
      price: 1099, // ₹1099 per month
      quota: 200,
      features: [
        { text: 'Up to 200 pages per PDF', footnote: 'The maximum amount of pages per PDF-file.' },
        { text: '12MB file size limit', footnote: 'The maximum file size of a single PDF file.' },
        { text: 'Mobile-friendly interface' },
        { text: 'Higher-quality conversion', footnote: 'Resource-intensive processing for enhanced content quality' },
        { text: 'Multilingual support' },
      ],
    },
    {
      plan: 'Premium',
      tagline: 'For business use-cases.',
      price: 2499, // ₹2499 per month
      quota: 500,
      features: [
        { text: 'Up to 500 pages per PDF', footnote: 'The maximum amount of pages per PDF-file.' },
        { text: '16MB file size limit', footnote: 'The maximum file size of a single PDF file.' },
        { text: 'Mobile-friendly interface' },
        { text: 'Highest-quality conversion', footnote: 'Resource-intensive processing for the best content quality' },
        { text: 'Multilingual support' },
      ],
    },
  ]
  