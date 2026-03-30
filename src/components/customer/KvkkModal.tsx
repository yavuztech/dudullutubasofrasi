import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function KvkkModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-in flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-bold text-gray-900 text-base">Kişisel Verilerin Korunması Hakkında Aydınlatma Metni</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 ml-2 flex-shrink-0">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 text-sm text-gray-700 leading-relaxed space-y-4">
          <section>
            <h4 className="font-semibold text-gray-900 mb-1">1. Veri Sorumlusu</h4>
            <p>
              Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında
              <strong> Dudullu Tuba Sofrası</strong> ("İşletme") tarafından hazırlanmıştır. İşletmemiz,
              kişisel verilerinizin işlenmesi konusunda veri sorumlusu sıfatını taşımaktadır.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-1">2. İşlenen Kişisel Veriler</h4>
            <p>Gel Al sipariş hizmeti kapsamında yalnızca aşağıdaki veriler toplanmaktadır:</p>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li>Ad ve soyad (isteğe bağlı)</li>
              <li>Cep telefonu numarası (zorunlu — sipariş doğrulama ve bildirim için)</li>
              <li>Cihaz bildirim kimliği / FCM token (isteğe bağlı — push bildirimi izni verilmesi hâlinde)</li>
            </ul>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-1">3. Kişisel Verilerin İşlenme Amaçları</h4>
            <p>Toplanan veriler yalnızca şu amaçlarla kullanılmaktadır:</p>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li>Siparişinizin alındığının teyit edilmesi</li>
              <li>Siparişiniz hazır olduğunda size bildirim gönderilmesi</li>
              <li>Sipariş takibinde kimlik doğrulama</li>
            </ul>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-1">4. Kişisel Verilerin Aktarılması</h4>
            <p>
              Kişisel verileriniz; reklam kuruluşları, pazarlama şirketleri veya herhangi bir kamu ya da
              özel kuruluşa <strong>kesinlikle aktarılmamakta ve satılmamaktadır.</strong>
            </p>
            <p className="mt-1">
              Ancak verileriniz, teknik altyapı sağlayıcımız olan <strong>Google LLC (Firebase)</strong>{' '}
              sunucularında şifreli olarak barındırılmaktadır. Google LLC, bu kapsamda bir{' '}
              <em>veri işleyici</em> olarak hareket etmekte olup kendi Gizlilik Politikası
              hükümlerine tabidir.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-1">5. Kişisel Verilerin Saklanma Süresi</h4>
            <p>
              Verileriniz, siparişin tamamlanmasının ardından işletme faaliyetleri kapsamında
              <strong> en fazla 1 (bir) yıl</strong> süreyle sistemde tutulur. Saklama süresinin
              sonunda verileriniz silinir. Süre dolmadan da talep etmeniz hâlinde verileriniz
              en geç <strong>30 gün</strong> içinde silinir (bkz. Madde 7).
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-1">6. Kişisel Verilerin Korunması</h4>
            <p>
              Verileriniz, Google Firebase altyapısında şifreli (HTTPS ve at-rest encryption) olarak
              depolanmaktadır. Sistemimize yalnızca yetkili personel erişebilmekte; üçüncü taraf
              izleme, reklam veya analitik araçları kullanılmamaktadır.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-1">7. Haklarınız (KVKK Madde 11) ve Başvuru Yolu</h4>
            <p>KVKK'nın 11. maddesi kapsamında aşağıdaki haklara sahipsiniz:</p>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
              <li>İşlenmişse buna ilişkin bilgi talep etme</li>
              <li>Yanlış veya eksik verilerin düzeltilmesini isteme</li>
              <li><strong>Kişisel verilerinizin silinmesini ya da yok edilmesini talep etme</strong></li>
              <li>İşlenen verilerin otomatik sistemler aracılığıyla aleyhinize bir sonuç doğurması durumunda itiraz etme</li>
            </ul>
            <p className="mt-2">
              Bu haklarınızı kullanmak için sipariş sırasında kullandığınız telefon numarasını
              belirterek işletmemize{' '}
              <strong>dudullutubasofrasi@gmail.com</strong> adresi üzerinden yazılı olarak
              başvurabilirsiniz. Başvurunuz en geç 30 gün içinde yanıtlanacaktır.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-1">8. Hukuki Dayanak</h4>
            <p>
              Kişisel verileriniz, KVKK'nın 5/2-c maddesi uyarınca "sözleşmenin kurulması veya ifası için
              zorunlu olması" hukuki sebebine dayanılarak işlenmektedir.
            </p>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="btn-primary w-full">
            Anladım, Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

