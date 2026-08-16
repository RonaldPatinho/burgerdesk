export interface CarouselPageState {
  signature: string;
  page: number;
}

export function paginateItems<T>(
  items: readonly T[],
  pageSize: number,
): readonly (readonly T[])[] {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError("El tamaño de página debe ser un entero positivo.");
  }

  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += pageSize) {
    pages.push(items.slice(index, index + pageSize));
  }
  return pages;
}

export function resolveCarouselPage(
  pageState: CarouselPageState,
  currentSignature: string,
  pageCount: number,
): number {
  if (pageCount <= 0) return 0;

  const requestedPage =
    pageState.signature === currentSignature ? pageState.page : 0;
  return Math.min(Math.max(requestedPage, 0), pageCount - 1);
}

export function previousCarouselPage(page: number, pageCount: number): number {
  if (pageCount <= 1) return 0;
  return (page - 1 + pageCount) % pageCount;
}

export function nextCarouselPage(page: number, pageCount: number): number {
  if (pageCount <= 1) return 0;
  return (page + 1) % pageCount;
}
