import countries from "world-countries";

const DENIED_COUNTRY_CODES = [
  "IR", // Iran
  "KP", // North Korea
  "SY", // Syria
  "CU", // Cuba
  "SD", // Sudan
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
