// Suite E2E en Playwright para validar diseño responsive en escritorio/móvil, visor fullscreen, skeletons y SSE en tiempo real.

import { expect, Page, test } from "@playwright/test";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";
const SCREENSHOT_DIR =
  "C:/Users/gaelt/.gemini/antigravity-cli/brain/5fd9e9b7-40ba-4413-9f63-946f727e1c57";

// Obtiene un token DRF directo contra el backend para crear y limpiar fixtures de prueba.
async function getApiToken(
  username: "admin" | "gael",
  password: string,
): Promise<string> {
  const res = await fetch(`${API_URL}/api-token-auth/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(`Auth failed for ${username}: ${res.status}`);
  }
  const data = await res.json();
  return data.token;
}

// Limpia el estado local e inicia sesión desde la pantalla de login hasta que aparezcan las pestañas.
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

// Selector tolerante a cómo React Native Web proyecta accessibilityLabel (aria-label o title).
function getCatalogCardsLocator(page: Page) {
  return page.locator('[aria-label*=", precio "], [title*=", precio "]');
}

// Espera a que las imágenes dentro del contenedor hayan cargado con ancho natural positivo y devuelve sus métricas.
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

test.describe("Nordika UX, Responsive, Skeletons & Realtime SSE", () => {
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

    // Verifica que existan al menos 2 tarjetas compartiendo la misma fila (cuadrícula multi-columna en escritorio).
    const desktopRowCheck = await expect
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
    void desktopRowCheck;

    // Verifica imágenes de catálogo cargadas con object-fit: contain y sin desbordamiento horizontal.
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

    // Pausa breve para que concluya el fade-in de expo-image antes de la captura.
    await page.waitForTimeout(350);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/desktop-catalog.png`,
    });

    // Abre la primera tarjeta que contenga imagen para validar la ficha de detalle en escritorio.
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

    // Confirma que el contenedor hero está acotado y centrado en 1280px (no estirado borde a borde).
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

    await page.waitForTimeout(350);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/desktop-detail.png`,
    });

    // Regresa al catálogo y cambia a viewport móvil (390x844) para confirmar diseño 1 columna + cover.
    const backBtn = page
      .getByLabel("Regresar al catálogo")
      .or(page.locator('[title="Regresar al catálogo"]'))
      .first();
    await backBtn.click();
    await expect(getCatalogCardsLocator(page).first()).toBeVisible({
      timeout: 10000,
    });

    await page.setViewportSize({ width: 390, height: 844 });

    // Verifica diseño de 1 sola columna: cada tarjeta debe apilarse verticalmente sin compartir fila.
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

    // En móvil se preserva object-fit: cover en las fotografías del catálogo.
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

    await page.waitForTimeout(350);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/mobile-catalog.png`,
    });
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

    // Abre el visor fullscreen haciendo clic en la imagen principal.
    await heroTrigger.click();
    const modal = page.getByTestId("fullscreen-image-modal");
    await expect(modal).toBeVisible({ timeout: 5000 });

    const modalImgs = await waitForLoadedImages(
      page,
      '[data-testid="fullscreen-image-modal"] img',
    );
    expect(modalImgs.count).toBeGreaterThan(0);
    expect(modalImgs.objectFits[0]).toBe("contain");

    await page.waitForTimeout(300);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/fullscreen-modal.png`,
    });

    // Cierra con la tecla Escape en Web.
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Vuelve a abrir y cierra mediante el botón accesible de cierre.
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

    // 3.1 Catálogo: retrasa la respuesta de /muebles/ para comprobar el CatalogSkeleton al recargar la vista.
    const catalogDelayHandler = async (route: any) => {
      if (route.request().method() === "GET") {
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
      await route.continue();
    };
    await page.route(/\/muebles\/(\?.*)?$/, catalogDelayHandler);

    await page.goto("/");
    const skeleton = page.getByTestId("skeleton-loader").first();
    await expect(skeleton).toBeVisible({ timeout: 8000 });

    // Una vez que llega la respuesta real, el skeleton desaparece y se muestran las tarjetas.
    await expect(page.getByTestId("skeleton-loader")).toHaveCount(0, {
      timeout: 15000,
    });
    await expect(getCatalogCardsLocator(page).first()).toBeVisible({
      timeout: 10000,
    });
    await page.unroute(/\/muebles\/(\?.*)?$/, catalogDelayHandler);

    // 3.2 Detalle de mueble: retrasa /muebles/:id/ para comprobar el MuebleDetailSkeleton.
    const detailDelayHandler = async (route: any) => {
      if (route.request().method() === "GET") {
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
      await route.continue();
    };
    await page.route(/\/muebles\/\d+\/?$/, detailDelayHandler);

    await getCatalogCardsLocator(page).first().click();
    await expect(page.getByTestId("skeleton-loader").first()).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByTestId("skeleton-loader")).toHaveCount(0, {
      timeout: 15000,
    });
    await expect(page.getByText("Detalle de Producto")).toBeVisible({
      timeout: 10000,
    });
    await page.unroute(/\/muebles\/\d+\/?$/, detailDelayHandler);

    // 3.3 Apartados: retrasa /apartados/ para comprobar el ApartadosSkeleton al entrar a la pestaña.
    const backBtn = page
      .getByLabel("Regresar al catálogo")
      .or(page.locator('[title="Regresar al catálogo"]'))
      .first();
    await backBtn.click();

    const apartadosDelayHandler = async (route: any) => {
      if (route.request().method() === "GET") {
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
      await route.continue();
    };
    await page.route(/\/apartados\/(\?.*)?$/, apartadosDelayHandler);

    const apartadosTab = page
      .getByLabel("Apartados de muebles")
      .or(page.getByRole("tab", { name: /apartados/i }))
      .first();
    await apartadosTab.click();
    await expect(page.getByTestId("skeleton-loader").first()).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByTestId("skeleton-loader")).toHaveCount(0, {
      timeout: 15000,
    });
    await expect(page.getByText("Gestión de Apartados")).toBeVisible({
      timeout: 10000,
    });
    await page.unroute(/\/apartados\/(\?.*)?$/, apartadosDelayHandler);
  });

  test("4. Sincronización en tiempo real por SSE sin recargar (Catálogo y Apartados)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const adminToken = await getApiToken("admin", "admin123");
    const gaelToken = await getApiToken("gael", "gael123");

    const [provRes, catRes] = await Promise.all([
      fetch(`${API_URL}/proveedores/`, {
        headers: { Authorization: `Token ${adminToken}` },
      }),
      fetch(`${API_URL}/categorias/`, {
        headers: { Authorization: `Token ${adminToken}` },
      }),
    ]);
    const provs = await provRes.json();
    const cats = await catRes.json();
    const provList = Array.isArray(provs) ? provs : provs.results;
    const catList = Array.isArray(cats) ? cats : cats.results;

    const ts = Date.now().toString().slice(-6);
    const sseMuebleName = `Mesa SSE Vivo ${ts}`;
    let createdMuebleId: number | null = null;
    let createdApartadoId: number | null = null;

    try {
      // Escucha el handshake HTTP 200 de /events/ para asegurar que el stream SSE ya está conectado antes de mutar.
      const sseHandshakePromise = page
        .waitForResponse(
          (res) => res.url().includes("/events/") && res.status() === 200,
          { timeout: 15000 },
        )
        .catch(() => null);

      await loginAs(page, "admin");
      await expect(getCatalogCardsLocator(page).first()).toBeVisible({
        timeout: 15000,
      });
      await sseHandshakePromise;
      await page.waitForTimeout(400);

      // Marca en window para demostrar que la actualización ocurre en vivo sin page.reload().
      await page.evaluate(() => {
        (window as any).__nordikaSseMarker = "sin-recarga";
      });

      // Crea el mueble desde la API REST mientras la pestaña de Catálogo permanece abierta.
      const createRes = await fetch(`${API_URL}/muebles/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${adminToken}`,
        },
        body: JSON.stringify({
          nombre: sseMuebleName,
          descripcion: "Fixture de verificación SSE en tiempo real",
          precio: "6490.00",
          stock: 4,
          proveedor_id: provList[0].id,
          categoria_id: catList[0].id,
        }),
      });
      expect(createRes.ok).toBe(true);
      const createdMueble = await createRes.json();
      createdMuebleId = createdMueble.id;

      // El nuevo mueble debe aparecer automáticamente en el Catálogo abierto vía SSE.
      await expect(page.getByText(sseMuebleName).first()).toBeVisible({
        timeout: 15000,
      });
      const catalogMarker = await page.evaluate(
        () => (window as any).__nordikaSseMarker,
      );
      expect(catalogMarker).toBe("sin-recarga");

      // Abre la pestaña de Apartados (Activos) como admin sin recargar la página.
      const apartadosTab = page
        .getByLabel("Apartados de muebles")
        .or(page.getByRole("tab", { name: /apartados/i }))
        .first();
      await apartadosTab.click();
      await expect(page.getByText("Gestión de Apartados")).toBeVisible({
        timeout: 10000,
      });
      await page.waitForTimeout(400);

      // Como cliente 'gael', crea un apartado sobre el mueble recién creado mediante la API REST.
      const apartadoRes = await fetch(`${API_URL}/apartados/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${gaelToken}`,
        },
        body: JSON.stringify({
          mueble_id: createdMuebleId,
          cantidad: 1,
        }),
      });
      expect(apartadoRes.ok).toBe(true);
      const createdApartado = await apartadoRes.json();
      createdApartadoId = createdApartado.id;

      // El nuevo apartado debe aparecer automáticamente en la pestaña Activos de admin vía SSE.
      await expect(page.getByText(createdApartado.codigo).first()).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText(sseMuebleName).first()).toBeVisible({
        timeout: 10000,
      });
      const apartadosMarker = await page.evaluate(
        () => (window as any).__nordikaSseMarker,
      );
      expect(apartadosMarker).toBe("sin-recarga");
    } finally {
      // Rechaza el apartado y elimina el mueble para dejar la base local intacta.
      if (createdApartadoId !== null) {
        await fetch(`${API_URL}/apartados/${createdApartadoId}/rechazar/`, {
          method: "POST",
          headers: { Authorization: `Token ${adminToken}` },
        }).catch(() => {});
      }
      if (createdMuebleId !== null) {
        await fetch(`${API_URL}/muebles/${createdMuebleId}/`, {
          method: "DELETE",
          headers: { Authorization: `Token ${adminToken}` },
        }).catch(() => {});
      }
    }
  });
});
