import countries from "world-countries";

const DENIED_COUNTRY_CODES = [
  "US", // United States
  "CA", // Canada
  "NL", // Netherlands
  "CU", // Cuba
  "KP", // North Korea
  "IR", // Iran
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
