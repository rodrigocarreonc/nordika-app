// Letras (incluye acentos, ñ y ü), espacios, apóstrofo y guion. Vacío es válido: los campos son opcionales.
const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]*$/;

export const isValidName = (value: string) => NAME_REGEX.test(value.trim());

export const NAME_ERROR = "El nombre y apellido solo pueden contener letras.";
