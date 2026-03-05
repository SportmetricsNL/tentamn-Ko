# TT Leerstof Arena

Interactieve leeromgeving voor **Kwalitatief Onderzoek** met focus op **Blok 1 t/m 5**.

## Wat is aangepast

- Toetsing is nu inhoudelijk gebaseerd op de kernblokken (niet op losse werkgroepslides).
- Handmatig opgebouwde vraagbank met methodologische integratievragen.
- Beslisboom/Artikelcheck toegevoegd (stap-voor-stap met herkenningswoorden).
- Casuslab toegevoegd met modelpunten.
- Overige TT-bestanden blijven beschikbaar als ondersteunende bronbibliotheek.

## Bestandsstructuur

- `index.html` - UI
- `styles.css` - styling
- `app.js` - interactie, voortgang, quiz- en casuslogica
- `data/course-data.json` - blokken, vragen, casussen en artikelcheck-gids
- `scripts/build_course_data.py` - generator voor `data/course-data.json`
- `materials/*.pdf` - originele bronbestanden

## Lokaal draaien

```bash
cd tentamn-Ko-publish-2
python3 -m http.server 8080
```

Open: [http://localhost:8080](http://localhost:8080)

## Data opnieuw genereren

```bash
python3 scripts/build_course_data.py
```

## GitHub Pages

1. Push naar `main`.
2. Ga naar `Settings` -> `Pages`.
3. Zet source op `Deploy from a branch` met `main` en `/ (root)`.

