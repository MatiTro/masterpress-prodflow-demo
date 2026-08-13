# ProdFlow 0.5.0 TEST

Statyczna wersja testowa aplikacji przygotowana do publikacji przez GitHub Pages.

## Publikacja na GitHub Pages

1. Rozpakuj paczkę.
2. Wgraj **zawartość** paczki do katalogu głównego repozytorium. Plik `index.html` musi znajdować się w katalogu głównym.
3. Zatwierdź zmiany w GitHubie. Obecna konfiguracja Pages automatycznie opublikuje nową wersję z gałęzi `main` i katalogu `/(root)`.
4. Po zakończeniu zadania `pages build and deployment` otwórz dotychczasowy adres strony.
5. Wykonaj twarde odświeżenie: `Ctrl+F5`.

Nie wgrywaj samego pliku ZIP do repozytorium - najpierw go rozpakuj.

## Dostęp testowy

- login: `admin`
- hasło: `admin`

## Adres e-mail magazynu

Wersja testowa otwiera gotową wiadomość w domyślnym programie pocztowym. Adres odbiorcy znajduje się na początku pliku `app.js`:

```js
warehouseEmail: "magazyn@masterpress.com.pl"
```

Jeżeli właściwy adres jest inny, wystarczy zmienić wyłącznie tę wartość przed wgraniem plików na GitHub.

## Zalecany test odbiorczy 0.5.0

1. Utwórz co najmniej dwa zlecenia i przekaż je do planowania.
2. W Panelu Operatora uruchom zlecenie i sprawdź automatyczną zmianę: I od 06:00 do 14:00, II od 14:00 do 22:00, III od 22:00 do 06:00.
3. Otwórz Kartę Produkcyjną bezpośrednio z Panelu Operatora.
4. Zgłoś wynik większy niż plan i sprawdź oznaczenie „Nadprodukcja”.
5. Zgłoś pobranie surowca oraz dobry wyrób, a następnie wydrukuj wspólny dokument PDF.
6. Utwórz zapotrzebowanie materiałowe. Materiał powinien być możliwy do wyboru wyłącznie z listy zlecenia, a po zapisaniu powinna otworzyć się gotowa wiadomość e-mail.
7. Zawieś zlecenie i następnie je wznów.
8. Oznacz zlecenie jako spadnięte. Powinno wrócić w Planowaniu do kolumny „Do zaplanowania” z zapisanym powodem.
9. W Planowaniu kliknij „Szczegóły” i sprawdź duży, wyśrodkowany podgląd Karty Produkcyjnej.
10. W Magazynie sprawdź wyłącznie kolejkę zapotrzebowań - rejestr ładunków został usunięty.

## Najważniejsze zmiany

- usunięto „Kontrolę jakości” z powodów zatrzymania produkcji;
- dodano dwa osobne przebiegi: zawieszenie z możliwością wznowienia oraz zlecenie spadnięte, wracające do planowania;
- dodano Kartę Produkcyjną jako dokument dostępny z Panelu Operatora;
- pobrania surowców i zgłoszenia dobrego wyrobu trafiają na jeden dokument PDF;
- zapotrzebowanie materiałowe przygotowuje kompletną wiadomość e-mail;
- materiał w zapotrzebowaniu jest wybierany wyłącznie z listy przypisanej do zlecenia;
- dopuszczono raportowanie nadprodukcji i dodano jej czytelny wskaźnik;
- zmiana operatora jest wyznaczana automatycznie na podstawie godziny;
- zmniejszono kafelki Planowania i dodano oznaczenia „Zawieszone” oraz „Spadnięte”;
- „Szczegóły” w Planowaniu pokazują właściwą Kartę Produkcyjną w dużym oknie;
- z modułu Magazyn usunięto sekcję ładunków D365;
- zachowano obsługę wielu niezależnych zleceń, responsywność i działanie na GitHub Pages.

## Ważne ograniczenia wersji testowej

Dane są zapisywane lokalnie w przeglądarce (`localStorage`), dlatego każdy komputer ma własny zestaw danych. Login `admin/admin` jest demonstracyjny. Statyczna strona nie może samodzielnie wysłać wiadomości bez usługi pocztowej, dlatego przygotowuje kompletny e-mail i otwiera go w programie pocztowym użytkownika; wysłanie wymaga potwierdzenia przez operatora.
