// Aviso legal: la página con los artistas de los sprites y el enlace desde el juego
module.exports = async ({ page, ok }) => {
  await page.goto('/legal');
  await page.waitFor(`document.querySelector('h1')`);
  ok(await page.eval(`document.querySelectorAll('.artists tbody tr').length`) > 100, 'la página legal lista a los artistas de los sprites');
  ok(await page.eval(`/contact@pokearenas\\.com/.test(document.body.textContent)`), 'tiene el correo de contacto');
  await page.click('English');
  await page.waitFor(`document.documentElement.lang === 'en'`);
  ok(/Legal notice/.test(await page.eval(`document.querySelector('h1').textContent`)), 'enlaza a la versión en inglés');

  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel')`);
  await page.click('Créditos');   // el botón de la barra legal
  await page.waitFor(`document.querySelector('.modal a[href^="/legal"]')`);
  ok(true, 'el aviso del juego enlaza a la página legal');
};
