# YolPay - Arkadaş Grubu Yol Paylaşımı

YolPay, arkadaş gruplarının işe gidiş-geliş araç paylaşımını, günlük şoför seçimini ve ay sonu adil ödeme hesaplarını kolaylaştıran modern bir web uygulamasıdır.

## Teknolojiler
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend:** Firebase (Auth, Firestore)
- **Harita:** Google Maps JS API

## Kurulum

1. Depoyu klonlayın.
2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```
3. `.env.local.example` dosyasını `.env.local` olarak kopyalayın ve Firebase/Google Maps anahtarlarınızı girin.
4. Geliştirme sunucusunu başlatın:
   ```bash
   npm run dev
   ```

## Özellikler
- **Google Auth:** Tek tıkla güvenli giriş.
- **Dinamik Takvim:** Günlük şoför ve katılımcı yönetimi.
- **Otomatik Hesaplama:** Kim kime ne kadar ödeyecek anında görün.
- **Trafik Destekli Harita:** Canlı trafik durumu ve rota yönetimi.
- **Mobil Öncelikli Tasarım:** Premium UI/UX deneyimi.

## Firestore Şeması
- `users`: Profil bilgileri ve roller.
- `groups`: Grup adı ve günlük sabit ücret.
- `trips`: Günlük yolculuk kayıtları.
- `routes`: Önceden tanımlanmış rotalar.

## Lisans
MIT
