export function isValidDate(tokenId?:string) {
  if(!tokenId) {
    return false;
  }
  const year = parseInt(tokenId.slice(0, 4));
  const month = parseInt(tokenId.slice(4, 6))-1;
  const day = parseInt(tokenId.slice(6, 8));

  const date = new Date(year, month, day);

  return !isNaN(date as any);
}