# Tikdam landing concept

Next.js, Tailwind CSS, Framer Motion and Lucide homepage. The root build serves the exported page at `/` and the React/Vite checker at `/app` on the same Cloudflare Worker.

```sh
npm ci
npm run dev
npm run lint
npm run build
```

The clickable demo is a front-end illustration. It does not call Meta or the production calculator, collect purchase details, file a claim, or promise a tax saving. The current app's India amount route is limited to a narrow office stationery case. The UK laptop card is a design preview based on [HMRC's Annual Investment Allowance guidance](https://www.gov.uk/capital-allowances/annual-investment-allowance); it displays an illustrative allowance, not a tax saving or a supported current-app result. India links to [CBIC's CGST Act](https://cbic-gst.gov.in/pdf/CGST-Act-Updated-31082021.pdf); applicable law and period require review. See `../BRAND.md` for the identity and the repo’s root `README.md` for actual V1 scope.

The design uses the receipt as its main visual material: a narrow paper demo, dashed dividers, crisp ink borders, and a lime checkmark. Wensity UI was used as a motion and component quality reference; no paid Wensity source or template is included.
