import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error("Missing #app root element");
}

app.innerHTML = `
  <section class="shell">
    <h1>Warp Voyage</h1>
    <p>Bootstrapping flight systems...</p>
  </section>
`;
