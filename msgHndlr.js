/**
 * Mengubah format nomor telepon menjadi format JID WhatsApp.
 * @param {string} phoneNumber Nomor telepon.
 * @returns {string} Nomor yang sudah diformat.
 */
export function formatWhatsappNumber(phoneNumber) {
    const cleanedNumber = phoneNumber.replace(/\D/g, '');
    return `${cleanedNumber}@s.whatsapp.net`;
}