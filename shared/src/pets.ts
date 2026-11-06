// Pets: small original creatures that follow your ghost. Each species comes in
// a few colours; every species/colour pair is its own shop item, e.g. "pet-bat-plum".

export const PET_SPECIES = {
  bat: { name: "Bat", price: 45 },
  wisp: { name: "Wisp", price: 55 },
  spider: { name: "Spider", price: 35 },
} as const;
export type PetSpecies = keyof typeof PET_SPECIES;

/** Colour names and fills. Rarer-looking colours cost a little more. */
export const PET_COLOURS = {
  plum: { name: "Plum", hex: "#8a63d2", extra: 0 },
  ember: { name: "Ember", hex: "#ff8a3c", extra: 10 },
  frost: { name: "Frost", hex: "#8fe3ff", extra: 15 },
} as const;
export type PetColour = keyof typeof PET_COLOURS;

export const petItemId = (species: PetSpecies, colour: PetColour): string => `pet-${species}-${colour}`;

/** The species and colour of a pet item id, or null if it isn't one. */
export function parsePetId(id: string): { species: PetSpecies; colour: PetColour } | null {
  const m = /^pet-([a-z]+)-([a-z]+)$/.exec(id);
  if (!m || !(m[1]! in PET_SPECIES) || !(m[2]! in PET_COLOURS)) return null;
  return { species: m[1] as PetSpecies, colour: m[2] as PetColour };
}

/** Every pet as a shop listing (kind "pet"), species by species. */
export const PET_ITEMS = (Object.keys(PET_SPECIES) as PetSpecies[]).flatMap((species) =>
  (Object.keys(PET_COLOURS) as PetColour[]).map((colour) => ({
    id: petItemId(species, colour),
    kind: "pet" as const,
    name: `${PET_COLOURS[colour].name} ${PET_SPECIES[species].name}`,
    price: PET_SPECIES[species].price + PET_COLOURS[colour].extra,
  })),
);
