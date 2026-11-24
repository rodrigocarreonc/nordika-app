// Playwright E2E suite that checks responsive desktop/mobile layout, the fullscreen viewer and skeleton loaders.

import { expect, Page, test } from "@playwright/test";

// Clears local state and logs in from the login screen until the tabs appear.
async function loginAs(page: Page, role: "admin" | "gael") {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  const usernameInput = page.getByPlaceholder("Ej. gael");
  if (!(await usernameInput.isVisible({ timeout: 6000 }).catch(() => false))) {
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
  }
  await expect(usernameInput).toBeVisible({ timeout: 15000 });

  const username = role === "admin" ? "admin" : "gael";
  const password = role === "admin" ? "admin123" : "gael123";

  await usernameInput.fill(username);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByText("Acceder", { exact: true }).click();

  const settingsTab = page
    .getByLabel("Ajustes y perfil")
    .or(page.getByRole("tab", { name: /Ajustes/i }));
  await expect(settingsTab.first()).toBeVisible({ timeout: 15000 });
}

// Selector tolerant of how React Native Web renders accessibilityLabel (aria-label or title).
function getCatalogCardsLocator(page: Page) {
  return page.locator('[aria-label*=", precio "], [title*=", precio "]');
}

// Waits for the images in the container to load with a positive natural width and returns their metrics.
async function waitForLoadedImages(
  page: Page,
  selector: string,
): Promise<{ count: number; objectFits: string[] }> {
  let lastResult = { count: 0, objectFits: [] as string[] };
  await expect
    .poll(
      async () => {
        lastResult = await page.evaluate((sel) => {
          const imgs = Array.from(
            document.querySelectorAll<HTMLImageElement>(sel),
          ).filter((img) => {
            const rect = img.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
          if (imgs.length === 0) return { count: 0, objectFits: [] };
          const allLoaded = imgs.every(
            (img) => img.complete && img.naturalWidth > 0,
          );
          if (!allLoaded) return { count: 0, objectFits: [] };
          return {
            count: imgs.length,
            objectFits: imgs.map((img) => getComputedStyle(img).objectFit),
          };
        }, selector);
        return lastResult.count;
      },
      { timeout: 15000, message: `Esperando imágenes cargadas en ${selector}` },
    )
    .toBeGreaterThan(0);

  return lastResult;
}

test.describe("Nordika Desktop UX, Responsive, Fullscreen & Skeletons", () => {
  test.setTimeout(90000);

  test("1. Escritorio (1280x800) multi-columna + contain, detalle acotado, y preservación móvil (390x844)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, "admin");

    const cards = getCatalogCardsLocator(page);
    await expect
      .poll(async () => cards.count(), { timeout: 15000 })
      .toBeGreaterThanOrEqual(2);

    // Checks that at least 2 cards share the same row (multi-column grid on desktop).
    await expect
      .poll(
        async () => {
          const count = await cards.count();
          const ys: number[] = [];
          for (let i = 0; i < Math.min(count, 6); i++) {
            const box = await cards.nth(i).boundingBox();
            if (box && box.width > 0) ys.push(box.y);
          }
          for (let i = 0; i < ys.length; i++) {
            for (let j = i + 1; j < ys.length; j++) {
              if (Math.abs(ys[i] - ys[j]) <= 10) return true;
            }
          }
          return false;
        },
        { timeout: 10000 },
      )
      .toBe(true);

    // Checks catalog images loaded with object-fit: contain and no horizontal overflow.
    const catalogImgSelector =
      '[aria-label*=", precio "] img, [title*=", precio "] img';
    const desktopImgs = await waitForLoadedImages(page, catalogImgSelector);
    expect(desktopImgs.count).toBeGreaterThan(0);
    for (const fit of desktopImgs.objectFits) {
      expect(fit).toBe("contain");
    }

    const desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(desktopOverflow).toBe(true);

    // Opens the first card with an image to check the detail screen on desktop.
    const cardWithImage = cards.filter({ has: page.locator("img") }).first();
    await expect(cardWithImage).toBeVisible({ timeout: 10000 });
    await cardWithImage.click();

    await expect(page.getByText("Detalle de Producto")).toBeVisible({
      timeout: 15000,
    });
    const heroTrigger = page
      .getByTestId("hero-image-fullscreen-trigger")
      .or(page.getByLabel("Ver imagen en pantalla completa"))
      .first();
    await expect(heroTrigger).toBeVisible({ timeout: 15000 });

    const heroImgs = await waitForLoadedImages(
      page,
      '[data-testid="hero-image-fullscreen-trigger"] img, [aria-label="Ver imagen en pantalla completa"] img',
    );
    expect(heroImgs.count).toBe(1);
    expect(heroImgs.objectFits[0]).toBe("contain");

    // Confirms the hero container is bounded and centered at 1280px (not stretched edge to edge).
    const heroBox = await heroTrigger.boundingBox();
    expect(heroBox).not.toBeNull();
    if (heroBox) {
      expect(heroBox.width).toBeLessThanOrEqual(900);
      expect(heroBox.x).toBeGreaterThan(100);
      const heroCenter = heroBox.x + heroBox.width / 2;
      expect(Math.abs(heroCenter - 640)).toBeLessThan(40);
    }

    const detailOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(detailOverflow).toBe(true);

    // Goes back to the catalog and switches to a mobile viewport (390x844) to confirm a 1-column + cover layout.
    const backBtn = page
      .getByLabel("Regresar al catálogo")
      .or(page.locator('[title="Regresar al catálogo"]'))
      .first();
    await backBtn.click();
    await expect(getCatalogCardsLocator(page).first()).toBeVisible({
      timeout: 10000,
    });

    await page.setViewportSize({ width: 390, height: 844 });

    // Checks the single-column layout: each card must stack vertically without sharing a row.
    await expect
      .poll(
        async () => {
          const count = await cards.count();
          if (count < 2) return false;
          const b0 = await cards.nth(0).boundingBox();
          const b1 = await cards.nth(1).boundingBox();
          if (!b0 || !b1) return false;
          return b1.y > b0.y + 80 && b0.width > 300;
        },
        { timeout: 10000 },
      )
      .toBe(true);

    // On mobile, object-fit: cover is kept for catalog photos.
    await expect
      .poll(
        async () => {
          const info = await waitForLoadedImages(page, catalogImgSelector);
          return info.objectFits.every((fit) => fit === "cover");
        },
        { timeout: 10000 },
      )
      .toBe(true);

    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(mobileOverflow).toBe(true);
  });

  test("2. Visor de imagen en pantalla completa: abrir, validar carga, cerrar con Escape y botón cerrar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, "admin");

    const cardWithImage = getCatalogCardsLocator(page)
      .filter({ has: page.locator("img") })
      .first();
    await expect(cardWithImage).toBeVisible({ timeout: 15000 });
    await cardWithImage.click();

    const heroTrigger = page
      .getByTestId("hero-image-fullscreen-trigger")
      .or(page.getByLabel("Ver imagen en pantalla completa"))
      .first();
    await expect(heroTrigger).toBeVisible({ timeout: 15000 });

    // Opens the fullscreen viewer by clicking the main image.
    await heroTrigger.click();
    const modal = page.getByTestId("fullscreen-image-modal");
    await expect(modal).toBeVisible({ timeout: 5000 });

    const modalImgs = await waitForLoadedImages(
      page,
      '[data-testid="fullscreen-image-modal"] img',
    );
    expect(modalImgs.count).toBeGreaterThan(0);
    expect(modalImgs.objectFits[0]).toBe("contain");

    // Closes with the Escape key on Web.
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Reopens and closes with the accessible close button.
    await heroTrigger.click();
    await expect(modal).toBeVisible({ timeout: 5000 });

    const closeBtn = page
      .getByLabel("Cerrar imagen en pantalla completa")
      .or(page.getByTestId("fullscreen-image-close"))
      .first();
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    await closeBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test("3. Skeleton loaders visibles durante latencia de red en Catálogo y Detalle/Apartados", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, "admin");
    await expect(getCatalogCardsLocator(page).first()).toBeVisible({
      timeout: 15000,
    });

    // 3.1 Catalog: holds GET /furniture/ with a controlled promise so CatalogSkeleton is visible without timing races.
    let releaseCatalog: (() => void) | null = null;
    const catalogDelayHandler = async (route: any) => {
      if (route.request().method() === "GET") {
        await new Promise<void>((resolve) => {
          releaseCatalog = resolve;
        });
      }
      await route.continue();
    };
    await page.route(/\/furniture\/(\?.*)?$/, catalogDelayHandler);

    const stockToggle = page
      .getByLabel("Filtro en stock")
      .or(page.locator('[title*="stock"]'))
      .first();
    await stockToggle.click();

    const skeleton = page.getByTestId("skeleton-loader").first();
    await expect(skeleton).toBeVisible({ timeout: 10000 });
    (releaseCatalog as (() => void) | null)?.();

    // Once the real response is released, the skeleton disappears and the cards show up.
    await expect(page.getByTestId("skeleton-loader")).toHaveCount(0, {
      timeout: 15000,
    });
    await expect(getCatalogCardsLocator(page).first()).toBeVisible({
      timeout: 10000,
    });
    await page.unroute(/\/furniture\/(\?.*)?$/, catalogDelayHandler);

    // 3.2 Furniture detail: holds GET /furniture/:id/ to check FurnitureDetailSkeleton.
    let releaseDetail: (() => void) | null = null;
    const detailDelayHandler = async (route: any) => {
      if (route.request().method() === "GET") {
        await new Promise<void>((resolve) => {
          releaseDetail = resolve;
        });
      }
      await route.continue();
    };
    await page.route(/\/furniture\/\d+\/?$/, detailDelayHandler);

    await getCatalogCardsLocator(page).first().click();
    await expect(page.getByTestId("skeleton-loader").first()).toBeVisible({
      timeout: 10000,
    });
    (releaseDetail as (() => void) | null)?.();

    await expect(page.getByTestId("skeleton-loader")).toHaveCount(0, {
      timeout: 15000,
    });
    await expect(page.getByText("Detalle de Producto")).toBeVisible({
      timeout: 10000,
    });
    await page.unroute(/\/furniture\/\d+\/?$/, detailDelayHandler);

    // 3.3 Reservations: holds GET /reservations/ to check ReservationsSkeleton when entering the tab.
    const backBtn = page
      .getByLabel("Regresar al catálogo")
      .or(page.locator('[title="Regresar al catálogo"]'))
      .first();
    await backBtn.click();

    let releaseReservations: (() => void) | null = null;
    const reservationsDelayHandler = async (route: any) => {
      if (route.request().method() === "GET") {
        await new Promise<void>((resolve) => {
          releaseReservations = resolve;
        });
      }
      await route.continue();
    };
    await page.route(/\/reservations\/(\?.*)?$/, reservationsDelayHandler);

    const reservationsTab = page
      .getByLabel("Apartados de muebles")
      .or(page.getByRole("tab", { name: /apartados/i }))
      .first();
    await reservationsTab.click();
    await expect(page.getByTestId("skeleton-loader").first()).toBeVisible({
      timeout: 10000,
    });
    (releaseReservations as (() => void) | null)?.();

    await expect(page.getByTestId("skeleton-loader")).toHaveCount(0, {
      timeout: 15000,
    });
    await expect(page.getByText("Gestión de Apartados")).toBeVisible({
      timeout: 10000,
    });
    await page.unroute(/\/reservations\/(\?.*)?$/, reservationsDelayHandler);
  });
});
