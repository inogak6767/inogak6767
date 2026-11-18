# Social Network Analysis (SNA) Local Dashboard

Aplikasi web lokal berbasis *single-dashboard* untuk melakukan pengambilan data akun dan postingan media sosial melalui **EnsembleData API**, memproses perhitungan metrik *Social Network Analysis* (SNA), dan memvisualisasikannya dalam bentuk graf interaktif beranimasi (*node* & *edge*).

## Fitur Utama
- **Pengambilan Data Otomatis (EnsembleData)**: Tarik data akun dan postingan berdasarkan *target username/keyword* atau topik *trending*.
- **Single-Page Interactive Dashboard**: Seluruh kontrol pencarian, pemilihan metrik, statistik, dan kanvas graf berada dalam satu layar terpadu.
- **Perhitungan Metrik SNA Dinamis**: Mendukung *Betweenness Centrality* (utama), *Degree Centrality*, *Closeness Centrality*, dan *PageRank / Eigenvector*.
- **Visualisasi Graf Beranimasi**: Simulasi fisika *node* dan *edge* interaktif (ukuran *node* menyesuaikan bobot skor metrik yang dipilih, arah panah menunjukkan relasi interaksi).

## Tech Stack
- **Backend**: Node.js (Express.js) + `graphology` (kalkulasi metrik SNA)
- **Frontend**: HTML5 + TailwindCSS + `Cytoscape.js` (rendering graf & animasi)
- **Database**: PostgreSQL (penyimpanan relasional & cache riwayat tarikan API)
- **Containerization**: Docker & Docker Compose

## Struktur Proyek
```text
sna-dashboard/
├── docker-compose.yml
├── .env
├── README.md
├── SRS.md
├── db/
│   └── init.sql
└── app/
    ├── Dockerfile
    ├── package.json
    ├── server.js
    └── public/
        ├── index.html
        └── app.js
```

## Cara Menjalankan (via Docker)
1. Salin atau sesuaikan file `.env` dan isi `ENSEMBLEDATA_API_KEY` dengan token akun Anda.
2. Jalankan perintah berikut di terminal pada direktori utama proyek:
   ```bash
   docker-compose up --build -d
   ```
3. Buka browser dan akses `http://localhost:3000`.
