function isValidUrl(url) {
  const regExp =
    /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/;
  if (url.match(regExp)) {
    return true;
  }
  return false;
}

module.exports = isValidUrl;
