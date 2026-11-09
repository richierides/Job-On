// Mattress sizes, not outer bed-frame dimensions. See HOMETAKING.md for sources.
export const bedSizes = [
  { id: "uk-single", region: "UK", label: "Single", width: 90, length: 190 },
  {
    id: "uk-small-double",
    region: "UK",
    label: "Small double",
    width: 120,
    length: 190,
  },
  { id: "uk-double", region: "UK", label: "Double", width: 135, length: 190 },
  { id: "uk-king", region: "UK", label: "King", width: 150, length: 200 },
  {
    id: "uk-super-king",
    region: "UK",
    label: "Super king",
    width: 180,
    length: 200,
  },
  {
    id: "us-twin",
    region: "US",
    label: "Twin / single",
    width: 96.52,
    length: 190.5,
  },
  {
    id: "us-full",
    region: "US",
    label: "Full / double",
    width: 137.16,
    length: 190.5,
  },
  { id: "us-queen", region: "US", label: "Queen", width: 152.4, length: 203.2 },
  { id: "us-king", region: "US", label: "King", width: 193.04, length: 203.2 },
] as const;
export type BedSizeId = (typeof bedSizes)[number]["id"];
export const bedSizeIds = bedSizes.map((size) => size.id) as [
  BedSizeId,
  ...BedSizeId[],
];
