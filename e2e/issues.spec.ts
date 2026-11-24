// Playwright E2E suite: checks critical flows (auth, filters, furniture CRUD, reservations and role permissions).

import { test, expect, Page } from "@playwright/test";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Gets an admin token straight from the API to create/clean up test fixtures in isolation.
async function getAdminToken(): Promise<string> {
  const res = await fetch(`${API_URL}/api-token-auth/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  if (!res.ok) throw new Error(`Admin auth failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

// Creates test furniture through the API; the photo is required, so a 1x1 GIF is attached.
async function createFurnitureFixture(
  token: string,
  fields: Record<string, string | number>,
): Promise<{ id: number }> {
  const gif = Uint8Array.from(
    "47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b"
      .match(/../g)!
      .map((h) => parseInt(h, 16)),
  );
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
  form.append("image", new Blob([gif], { type: "image/gif" }), "fixture.gif");
  const res = await fetch(`${API_URL}/furniture/`, {
    method: "POST",
    headers: { Authorization: `Token ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Fixture creation failed: ${res.status}`);
  return res.json();
}

// Idempotent cleanup in a finally block so no test furniture is left in the local database.
async function apiDeleteFurnitureById(token: string, id: number) {
  await fetch(`${API_URL}/furniture/${id}/`, {
    method: "DELETE",
    headers: { Authorization: `Token ${token}` },
  }).catch(() => {});
}

// Clears localStorage and logs in through the UI with the given demo account until the tabs load.
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

test.describe("Nordika E2E Full Issue Verification Suite", () => {
  test.setTimeout(60000);

  test("1. Authentication, Admin Add Client modal (validation, backdrop click, submit), & Logout ConfirmDialog", async ({
    page,
  }) => {
    await loginAs(page, "admin");

    const settingsTab = page
      .getByLabel("Ajustes y perfil")
      .or(page.getByRole("tab", { name: /Ajustes/i }));
    await settingsTab.first().click();
    await expect(page.getByText("Ajustes & Perfil")).toBeVisible({
      timeout: 10000,
    });

    const addClientBtn = page
      .locator('[title="Agregar nuevo cliente"]')
      .or(page.getByText("Agregar Nuevo Cliente"));
    await expect(addClientBtn.first()).toBeVisible({ timeout: 15000 });
    await expect(addClientBtn.first()).toHaveAttribute(
      "title",
      "Agregar nuevo cliente",
    );

    // Open "Registrar Nuevo Cliente" modal
    await addClientBtn.first().click();
    await expect(page.getByText("Registrar Nuevo Cliente")).toBeVisible({
      timeout: 5000,
    });

    // Inline validation error inside modal
    await page.getByText("Registrar Cliente").first().click();
    await expect(
      page.getByText("El nombre de usuario es obligatorio."),
    ).toBeVisible({ timeout: 5000 });

    // Backdrop dismiss: click outside modal content
    const backdrop = page.getByLabel("Cerrar ventana emergente");
    await backdrop.click({ position: { x: 10, y: 10 }, force: true });
    await expect(page.getByText("Registrar Nuevo Cliente")).not.toBeVisible({
      timeout: 5000,
    });

    // Reopen, verify Confirmar contraseña mismatch error, then submit valid client
    await addClientBtn.first().click();
    await expect(page.getByText("Registrar Nuevo Cliente")).toBeVisible({
      timeout: 5000,
    });

    const uniqueId = Date.now().toString().slice(-6);
    const testUser = `cliente_${uniqueId}`;
    const testEmail = `cli_${uniqueId}@nordika.com`;

    await page.getByPlaceholder("Ej. cliente123").fill(testUser);
    await page.getByPlaceholder("cliente@nordika.com").fill(testEmail);
    await page
      .getByPlaceholder("Contraseña", { exact: true })
      .fill("pass123456");
    await page.getByPlaceholder("Repite la contraseña").fill("otra_pass123");
    await page.getByPlaceholder("Nombre").fill("TestNombre");
    await page.getByPlaceholder("Apellido").fill("TestApellido");

    await page.getByText("Registrar Cliente").first().click();
    await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible({
      timeout: 5000,
    });

    await page.getByPlaceholder("Repite la contraseña").fill("pass123456");
    await page.getByText("Registrar Cliente").first().click();

    const successAlert = page.getByText("Cliente registrado exitosamente.");
    await expect(successAlert).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Aceptar" }).last().click();
    await expect(successAlert).not.toBeVisible({ timeout: 5000 });

    // Verify Logout button & ConfirmDialog
    const logoutBtn = page
      .locator('[title="Cerrar sesión"]')
      .or(page.getByText("Cerrar Sesión"));
    await expect(logoutBtn.first()).toBeVisible();
    await expect(logoutBtn.first()).toHaveAttribute("title", "Cerrar sesión");

    await logoutBtn.first().click();
    const confirmLogoutMsg = page.getByText(
      "¿Estás seguro de que deseas salir de tu cuenta?",
    );
    await expect(confirmLogoutMsg).toBeVisible({ timeout: 5000 });

    // Cancel preserves session
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(confirmLogoutMsg).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Ajustes & Perfil")).toBeVisible();

    // Confirm logout redirects to login
    await logoutBtn.first().click();
    await expect(confirmLogoutMsg).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Cerrar Sesión" }).last().click();
    await expect(page.getByText("Iniciar Sesión")).toBeVisible({
      timeout: 10000,
    });
  });

  test("2. Catalog filters (search, clear, category chips, in-stock toggle, ordering modal) and safeBack", async ({
    page,
  }) => {
    const token = await getAdminToken();
    const supplierRes = await fetch(`${API_URL}/suppliers/`, {
      headers: { Authorization: `Token ${token}` },
    });
    const supplierData = await supplierRes.json();
    const supplierList = Array.isArray(supplierData) ? supplierData : supplierData.results;
    const catRes = await fetch(`${API_URL}/categories/`, {
      headers: { Authorization: `Token ${token}` },
    });
    const cats = await catRes.json();
    const catList = Array.isArray(cats) ? cats : cats.results;

    const ts = Date.now().toString().slice(-6);
    const inStockName = `E2E Sofá Stock ${ts}`;
    const outOfStockName = `E2E Mesa Agotada ${ts}`;

    const createdIds: number[] = [];
    try {
      const m1 = await createFurnitureFixture(token, {
          name: inStockName,
          description: "Filtro en stock E2E",
          price: "5000.00",
          stock: 5,
          supplier_id: supplierList[0].id,
          category_id: catList[0].id,
        });
      createdIds.push(m1.id);

      const m2 = await createFurnitureFixture(token, {
          name: outOfStockName,
          description: "Filtro agotado E2E",
          price: "12000.00",
          stock: 0,
          supplier_id: supplierList[0].id,
          category_id: catList[0].id,
        });
      createdIds.push(m2.id);

      await loginAs(page, "admin");

      const catalogTab = page
        .getByLabel("Catálogo de muebles")
        .or(page.getByRole("tab", { name: /Catálogo/i }));
      await catalogTab.first().click();

      // 2.1 Search filter matching both test items
      const searchInput = page.getByPlaceholder(
        "Buscar sofás, mesas, recámaras...",
      );
      await expect(searchInput).toBeVisible({ timeout: 10000 });
      await searchInput.fill(ts);
      await searchInput.press("Enter");

      await expect(page.getByText(inStockName)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(outOfStockName)).toBeVisible({
        timeout: 10000,
      });

      // 2.2 Toggle "En stock" filter -> outOfStockName disappears while inStockName stays
      const stockFilter = page
        .getByLabel("Filtro en stock")
        .or(page.locator('[title*="stock"]'))
        .first();
      await expect(stockFilter).toBeVisible();
      await stockFilter.click();

      await expect(page.getByText(inStockName)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(outOfStockName)).not.toBeVisible({
        timeout: 10000,
      });

      // Toggle off -> outOfStockName returns
      await stockFilter.click();
      await expect(page.getByText(outOfStockName)).toBeVisible({
        timeout: 10000,
      });

      // 2.3 Category chip filter + "Todas"
      const catChip = page
        .locator(`[title="Categoría: ${catList[0].name}"]`)
        .first();
      await expect(catChip).toBeVisible();
      await catChip.click();
      await expect(page.getByText(inStockName)).toBeVisible({ timeout: 10000 });

      const allCatChip = page.locator('[title="Categoría: Todas"]').first();
      await allCatChip.click();

      // 2.4 Clear search button
      const clearBtn = page
        .getByLabel("Limpiar texto de búsqueda")
        .or(page.locator('[title="Limpiar búsqueda"]'))
        .first();
      await expect(clearBtn).toBeVisible();
      await clearBtn.click();
      await expect(searchInput).toHaveValue("");

      // 2.5 Ordering modal: backdrop dismiss + select option
      const orderBtn = page.locator('[title="Ordenar catálogo"]').first();
      await expect(orderBtn).toBeVisible();
      await orderBtn.click();
      await expect(page.getByText("Ordenar Catálogo")).toBeVisible({
        timeout: 5000,
      });

      const orderBackdrop = page.getByLabel("Cerrar modal de ordenamiento");
      await orderBackdrop.click({ position: { x: 10, y: 10 }, force: true });
      await expect(page.getByText("Ordenar Catálogo")).not.toBeVisible({
        timeout: 5000,
      });

      await orderBtn.click();
      await page.getByText("Precio: menor a mayor").click();
      await expect(page.getByText("Ordenar Catálogo")).not.toBeVisible({
        timeout: 5000,
      });

      // 2.6 Open specific test furniture card and verify safeBack
      await searchInput.fill(inStockName);
      await searchInput.press("Enter");
      const card = page
        .locator(`[title^="${inStockName}, precio "]`)
        .or(page.getByText(inStockName))
        .first();
      await expect(card).toBeVisible({ timeout: 10000 });
      await card.click();

      const backBtn = page.locator('[title="Regresar al catálogo"]').first();
      await expect(backBtn).toBeVisible({ timeout: 10000 });
      await backBtn.click();
      await expect(
        page.locator('[title="Ordenar catálogo"]').first(),
      ).toBeVisible({ timeout: 10000 });
    } finally {
      for (const id of createdIds) {
        await apiDeleteFurnitureById(token, id);
      }
    }
  });

  test("3. Admin Mueble Creation (safe navigation & no duplicate) and Deletion via ConfirmDialog", async ({
    page,
  }) => {
    await loginAs(page, "admin");

    const newButton = page
      .locator('[title="Nuevo mueble"]')
      .or(page.getByText("Nuevo", { exact: true }))
      .first();
    await expect(newButton).toBeVisible({ timeout: 10000 });
    await newButton.click();

    await expect(page.getByText("Nuevo Mueble").first()).toBeVisible({
      timeout: 10000,
    });

    const uniqueFurnitureName = `Silla E2E Nordic ${Date.now().toString().slice(-5)}`;
    await page
      .getByPlaceholder("Ej. Sofá Nórdico Oslo 3 Plazas")
      .fill(uniqueFurnitureName);
    await page
      .getByPlaceholder("Escribe características, materiales, dimensiones...")
      .fill("Madera maciza de pino nórdico.");
    await page.getByPlaceholder("Ej. 14999.00").fill("2890.00");
    await page.getByPlaceholder("Ej. 5").fill("15");

    // The photo is required on create; expo-image-picker on Web opens an <input type="file">.
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByLabel("Subir o cambiar foto del mueble").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles("assets/images/favicon.png");

    await page
      .getByRole("checkbox", { name: /Categoría/ })
      .first()
      .click();
    await page
      .getByRole("radio", { name: /Proveedor/ })
      .first()
      .click();

    const saveBtn = page
      .locator('[title="Guardar mueble"]')
      .or(page.getByText("Guardar", { exact: true }))
      .last();
    await saveBtn.click();

    const successDialog = page.getByText("Mueble registrado exitosamente.");
    await expect(successDialog).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Aceptar" }).last().click();

    // Navigated back to catalog -> prevents accidental duplicate creation
    await expect(page.getByText("Nuevo Mueble").first()).not.toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.locator('[title="Ordenar catálogo"]').first(),
    ).toBeVisible({ timeout: 10000 });

    // Search for the exact created item
    const searchInput = page.getByPlaceholder(
      "Buscar sofás, mesas, recámaras...",
    );
    await searchInput.fill(uniqueFurnitureName);
    await searchInput.press("Enter");

    const createdCard = page
      .locator(`[title^="${uniqueFurnitureName}, precio "]`)
      .first();
    await expect(createdCard).toBeVisible({ timeout: 15000 });
    await createdCard.click();

    const deleteBtn = page.locator('[title="Eliminar mueble"]').last();
    await expect(deleteBtn).toBeVisible({ timeout: 10000 });
    await deleteBtn.click();

    const confirmDeleteTitle = page.getByText("Eliminar Mueble");
    await expect(confirmDeleteTitle).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(confirmDeleteTitle).not.toBeVisible({ timeout: 5000 });

    await deleteBtn.click();
    await expect(confirmDeleteTitle).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();

    const deleteSuccessMsg = page.getByText("El mueble ha sido eliminado.");
    await expect(deleteSuccessMsg).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Aceptar" }).last().click();

    await expect(
      page.locator('[title="Ordenar catálogo"]').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("4. Pipeline: Apartar -> Reject Apartado (with contact & Historial filter) -> Delete Mueble succeeds", async ({
    page,
  }) => {
    const token = await getAdminToken();
    const supplierRes = await fetch(`${API_URL}/suppliers/`, {
      headers: { Authorization: `Token ${token}` },
    });
    const supplierData = await supplierRes.json();
    const supplierList = Array.isArray(supplierData) ? supplierData : supplierData.results;
    const catRes = await fetch(`${API_URL}/categories/`, {
      headers: { Authorization: `Token ${token}` },
    });
    const cats = await catRes.json();
    const catList = Array.isArray(cats) ? cats : cats.results;

    const ts = Date.now().toString().slice(-6);
    const targetFurnitureName = `Sillón E2E Apartado ${ts}`;
    let createdFurnitureId: number | null = null;

    try {
      const m = await createFurnitureFixture(token, {
          name: targetFurnitureName,
          description: "Prueba pipeline apartado rechazado + eliminar mueble",
          price: "4500.00",
          stock: 4,
          supplier_id: supplierList[0].id,
          category_id: catList[0].id,
        });
      createdFurnitureId = m.id;

      // 4.1 Customer 'gael' reserves the specific furniture
      await loginAs(page, "gael");
      const searchInput = page.getByPlaceholder(
        "Buscar sofás, mesas, recámaras...",
      );
      await searchInput.fill(targetFurnitureName);
      await searchInput.press("Enter");

      const card = page.getByText(targetFurnitureName).first();
      await expect(card).toBeVisible({ timeout: 10000 });
      await card.click();

      const reserveButton = page
        .getByLabel("Apartar mueble")
        .or(page.locator('[title="Apartar mueble"]'))
        .first();
      await expect(reserveButton).toBeVisible({ timeout: 10000 });
      await reserveButton.click();

      await expect(page.getByText("Mueble apartado")).toBeVisible({
        timeout: 10000,
      });
      await page.getByRole("button", { name: "Aceptar" }).last().click();

      // 4.2 Admin tries to delete while PENDING -> must block with a 409 dialog
      await loginAs(page, "admin");
      const adminSearch = page.getByPlaceholder(
        "Buscar sofás, mesas, recámaras...",
      );
      await adminSearch.fill(targetFurnitureName);
      await adminSearch.press("Enter");

      await page.getByText(targetFurnitureName).first().click();
      const deleteBtn = page.locator('[title="Eliminar mueble"]').first();
      await expect(deleteBtn).toBeVisible({ timeout: 10000 });
      await deleteBtn.click();
      await page.getByRole("button", { name: "Eliminar", exact: true }).click();

      const blockedMsg = page.getByText(
        "No se puede eliminar: el mueble tiene 1 apartado asociado.",
      );
      await expect(blockedMsg).toBeVisible({ timeout: 10000 });
      await page.getByRole("button", { name: "Aceptar" }).last().click();
      await expect(blockedMsg).not.toBeVisible({ timeout: 5000 });

      // 4.3 Admin goes to Apartados, verifies contact info, and REJECTS the reservation
      await page.locator('[title="Regresar al catálogo"]').first().click();
      const reservationsTab = page
        .getByLabel("Apartados de muebles")
        .or(page.getByRole("tab", { name: /apartados/i }));
      await reservationsTab.first().click();
      await expect(page.getByText("Gestión de Apartados")).toBeVisible({
        timeout: 10000,
      });

      const targetCard = page
        .locator("div")
        .filter({ hasText: targetFurnitureName })
        .filter({ hasText: "Rechazar" })
        .last();
      await expect(targetCard).toBeVisible({ timeout: 15000 });
      await expect(targetCard.locator("text=/Cliente:.*@gael/")).toBeVisible();
      await expect(targetCard.locator("text=/Contacto:.*/")).toBeVisible();

      // Click Rechazar -> ConfirmDialog
      await targetCard.getByText("Rechazar", { exact: true }).click();
      const confirmRejectTitle = page.getByText("Rechazar apartado");
      await expect(confirmRejectTitle).toBeVisible({ timeout: 5000 });
      await page.getByRole("button", { name: "Rechazar" }).last().click();
      await expect(confirmRejectTitle).not.toBeVisible({ timeout: 10000 });

      // Disappears from Activos filter
      const activeTargetCard = page
        .locator("div")
        .filter({ hasText: targetFurnitureName })
        .filter({ hasText: "Rechazar" });
      await expect(activeTargetCard).not.toBeVisible({ timeout: 10000 });

      // Appears under Historial filter as Rechazado
      const tabHistory = page
        .getByRole("tab", { name: /Historial/i })
        .or(page.getByText("Historial", { exact: true }))
        .first();
      await tabHistory.click();
      const historyCard = page
        .locator("div")
        .filter({ hasText: targetFurnitureName })
        .filter({ hasText: "Rechazado" })
        .last();
      await expect(historyCard).toBeVisible({ timeout: 10000 });

      // 4.4 Now Admin deletes that furniture -> MUST succeed cleanly (204)
      const catalogTab = page
        .getByLabel("Catálogo de muebles")
        .or(page.getByRole("tab", { name: /Catálogo/i }));
      await catalogTab.first().click();

      const adminSearch2 = page.getByPlaceholder(
        "Buscar sofás, mesas, recámaras...",
      );
      await adminSearch2.fill(targetFurnitureName);
      await adminSearch2.press("Enter");
      const catalogCardAfter = page
        .locator(`[title^="${targetFurnitureName}, precio "]`)
        .first();
      await expect(catalogCardAfter).toBeVisible({ timeout: 10000 });
      await catalogCardAfter.click();

      const deleteBtnAfter = page.locator('[title="Eliminar mueble"]').last();
      await expect(deleteBtnAfter).toBeVisible({ timeout: 10000 });
      await deleteBtnAfter.click();
      await page.getByRole("button", { name: "Eliminar", exact: true }).click();

      const deletedSuccess = page.getByText("El mueble ha sido eliminado.");
      await expect(deletedSuccess).toBeVisible({ timeout: 15000 });
      await page.getByRole("button", { name: "Aceptar" }).last().click();
      createdFurnitureId = null; // deleted via UI
    } finally {
      if (createdFurnitureId !== null) {
        await apiDeleteFurnitureById(token, createdFurnitureId);
      }
    }
  });

  test("5. Client (gael) login and permissions boundary check", async ({
    page,
  }) => {
    await loginAs(page, "gael");

    const catalogTab = page
      .getByLabel("Catálogo de muebles")
      .or(page.getByRole("tab", { name: /Catálogo/i }));
    await catalogTab.first().click();
    await expect(page.locator('[title="Nuevo mueble"]')).not.toBeVisible();

    const reservationsTab = page
      .getByLabel("Apartados de muebles")
      .or(page.getByRole("tab", { name: /apartados/i }));
    await reservationsTab.first().click();
    await expect(page.getByText("Mis Apartados")).toBeVisible({
      timeout: 10000,
    });

    const settingsTab = page
      .getByLabel("Ajustes y perfil")
      .or(page.getByRole("tab", { name: /Ajustes/i }));
    await settingsTab.first().click();
    await expect(
      page.locator('[title="Agregar nuevo cliente"]'),
    ).not.toBeVisible();
  });
});
