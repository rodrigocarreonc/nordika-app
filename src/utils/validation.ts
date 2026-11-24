// Shared first/last name validation for sign-up, profile and customer creation.
// Letters (including accents, ñ and ü), spaces, apostrophe and hyphen. Empty is valid: the fields are optional.
const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]*$/;

export const isValidName = (value: string) => NAME_REGEX.test(value.trim());

export const NAME_ERROR = "El nombre y apellido solo pueden contener letras.";
