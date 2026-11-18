# Software Requirements Specification (SRS)
**Nama Sistem:** Local Social Network Analysis (SNA) Dashboard  
**Versi:** 1.0  

---

## 1. Pendahuluan
### 1.1 Tujuan
Dokumen ini mendefinisikan spesifikasi kebutuhan perangkat lunak untuk membangun aplikasi web lokal yang mampu menganalisis akun dan postingan media sosial menggunakan metode *Social Network Analysis* (SNA) dalam satu tampilan dashboard terpadu.

### 1.2 Ruang Lingkup
- Berjalan secara lokal di dalam container **Docker**.
- Mengambil data media sosial secara dinamis melalui **EnsembleData API** berdasarkan input **Target** maupun **Trending**.
- Menghitung metrik jaringan menggunakan **Node.js** dan menyimpannya ke database lokal (**PostgreSQL**).
- Menampilkan hasil dalam bentuk **graf interaktif beranimasi** (*node* dan *edge*) dengan opsi pergantian metrik SNA.

---

## 2. Kebutuhan Fungsional (Functional Requirements)

| ID | Fitur | Deskripsi Kebutuhan |
| :--- | :--- | :--- |
| **FR-01** | **Input Target & Trending** | Pengguna dapat memilih mode pengambilan data berdasarkan **Target** (akun/username/postingan spesifik) atau **Trending** (topik/hashtag populer) dari platform yang didukung EnsembleData. |
| **FR-02** | **Integrasi EnsembleData API** | Sistem menarik data akun, postingan, komentar, *mention*, dan interaksi dari EnsembleData lalu menormalisasikannya menjadi entitas *node* dan *edge*. |
| **FR-03** | **Pemilihan Metrik SNA** | Sistem menyediakan pilihan metrik yang dapat diganti secara *real-time* di dashboard:<br>• **Betweenness Centrality** (default - mendeteksi aktor jembatan informasi)<br>• **Degree Centrality** (mengukur jumlah koneksi langsung)<br>• **Closeness Centrality** (mengukur kecepatan penyebaran informasi)<br>• **Eigenvector / PageRank** (mengukur pengaruh jaringan) |
| **FR-04** | **Visualisasi Graf & Animasi** | Sistem merender jaringan dalam bentuk **Node** (akun/postingan) dan **Edge** (relasi interaksi) lengkap dengan animasi tata letak (*force-directed layout*), *zoom*, *pan*, dan *drag*. |
| **FR-05** | **Skala Visual Dinamis** | Ukuran *node* pada graf otomatis menyesuaikan bobot skor metrik SNA yang sedang dipilih pengguna. |
| **FR-06** | **Single-Dashboard Terpadu** | Seluruh fungsi (input data, filter metrik, kanvas graf animasi, peringkat aktor teratas, dan detail inspektor *node*) termuat dalam satu halaman web tanpa perpindahan halaman. |

---

## 3. Kebutuhan Non-Fungsional (Non-Functional Requirements)
- **NFR-01 (Containerization):** Seluruh layanan (aplikasi Node.js dan database PostgreSQL) dikemas menggunakan **Docker** dan **Docker Compose** agar mudah dijalankan di lingkungan lokal mana pun.
- **NFR-02 (Efisiensi Kuota API):** Data yang telah ditarik dari EnsembleData disimpan ke database lokal sehingga pergantian metrik atau peninjauan ulang riwayat tidak memanggil API berulang kali.
- **NFR-03 (Responsivitas Graf):** Animasi fisika *node* dan *edge* harus berjalan mulus saat pengguna mengubah metrik atau berinteraksi dengan kanvas.

---

## 4. Rekomendasi Skema Tabel Database (PostgreSQL)

### 4.1 Tabel `search_sessions`
Menyimpan riwayat sesi pengambilan data berdasarkan target atau trending.
- `id` (`SERIAL PRIMARY KEY`): ID unik sesi.
- `platform` (`VARCHAR(50)`): Platform media sosial (`tiktok`, `instagram`, `threads`, dll).
- `query_type` (`VARCHAR(20)`): Jenis pencarian (`TARGET` atau `TRENDING`).
- `query_value` (`VARCHAR(255)`): Username, hashtag, atau kata kunci yang dicari.
- `created_at` (`TIMESTAMP`): Waktu penarikan data.

### 4.2 Tabel `sna_nodes`
Menyimpan entitas aktor (akun) maupun postingan beserta skor metrik SNA.
- `id` (`SERIAL PRIMARY KEY`): ID internal *node*.
- `session_id` (`INT REFERENCES search_sessions(id)`): Relasi ke sesi pencarian.
- `external_id` (`VARCHAR(100)`): ID unik akun/postingan dari platform asal.
- `node_type` (`VARCHAR(20)`): Tipe entitas (`ACCOUNT`, `POST`, atau `TARGET`).
- `label` (`VARCHAR(150)`): Nama tampilan pada graf.
- `metadata` (`JSONB`): Detail atribut akun/postingan (jumlah followers, caption, bio, dll).
- `metrics` (`JSONB`): Skor hasil perhitungan SNA (`{"betweenness": 0.42, "degree": 0.65, "closeness": 0.51}`).

### 4.3 Tabel `sna_edges`
Menyimpan hubungan/interaksi antar *node*.
- `id` (`SERIAL PRIMARY KEY`): ID unik *edge*.
- `session_id` (`INT REFERENCES search_sessions(id)`): Relasi ke sesi pencarian.
- `source_node_id` (`INT REFERENCES sna_nodes(id)`): *Node* asal interaksi.
- `target_node_id` (`INT REFERENCES sna_nodes(id)`): *Node* tujuan interaksi.
- `interaction_type` (`VARCHAR(50)`): Jenis relasi (`MENTION`, `REPLY`, `COMMENT`, `SHARE`, `POSTED_IN`).
- `weight` (`FLOAT DEFAULT 1.0`): Bobot kekuatan interaksi.

---

## 5. Arsitektur Docker
Sistem dijalankan menggunakan dua container utama dalam satu jaringan internal Docker:
1. **`sna_nodejs_app` (Node.js 20 Alpine)**: Menjalankan REST API backend, engine kalkulasi `graphology`, serta menyajikan antarmuka *single-dashboard* HTML/JS.
2. **`sna_postgres` (PostgreSQL 16 Alpine)**: Menyimpan seluruh data sesi, *node*, *edge*, dan hasil perhitungan metrik secara persisten menggunakan Docker Volume.
