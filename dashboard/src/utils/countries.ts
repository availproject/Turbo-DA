import countries from "world-countries";

const DENIED_COUNTRY_CODES = [
  "CU", // Cuba
  "KP", // North Korea
  "IR", // Iran
  "SY", // Syria
  "SD", // Sudan
  "SS", // South Sudan
  // Regions
  "UA-43", // Crimea (using ISO 3166-2 code)
  "UA-14", // Donetsk (using ISO 3166-2 code)
  "UA-09", // Luhansk (using ISO 3166-2 code)
];

export const isDeniedCountry = (countryCode: string) => {
  return DENIED_COUNTRY_CODES.includes(countryCode);
};

export const isDeniedCountryByName = (countryName: string) => {
  const country = countries.find(
    (c) => c.name.common.toLowerCase() === countryName.toLowerCase(),
  );
  return country ? isDeniedCountry(country.cca2) : false;
};

export const getCountryList = () => {
  return countries
    .map((country) => ({
      code: country.cca2,
      name: country.name.common,
      flag: country.flag,
      isDenied: isDeniedCountry(country.cca2),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};
