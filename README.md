# TT Leerstof Arena

Interactieve leeromgeving voor **Kwalitatief Onderzoek** met alle bestanden uit `TT leerstof`:

- 23 bron-PDF's in [`materials/`](./materials)
- per bron automatisch gegenereerde:
  - kernpunten
  - kernbegrippen
  - flashcards
  - multiple-choice quizvragen
- sprinttoets over alle bronnen
- voortgang + zwakke begrippen opgeslagen in browser (`localStorage`)

## Structuur

- `index.html` - app shell
- `styles.css` - responsive UI
- `app.js` - interactie, voortgang, quizlogica
- `data/modules.json` - leerdata voor alle bronnen
- `materials/*.pdf` - originele bronbestanden
- `scripts/build_content.py` - generator voor `data/modules.json`

## Lokaal draaien

Er is geen buildstap nodig.

```bash
cd tentamn-Ko
python3 -m http.server 8080
```

Open daarna: [http://localhost:8080](http://localhost:8080)

## Data opnieuw genereren

Vereist: Python 3 + `pypdf`

```bash
python3 -m pip install --user pypdf
python3 scripts/build_content.py
```

## Publiceren op GitHub Pages

1. Push deze inhoud naar `main`.
2. Ga naar `Settings` -> `Pages`.
3. Kies `Deploy from a branch`.
4. Selecteer branch `main` en folder `/ (root)`.
5. Sla op; na deploy draait de app direct als statische site.

