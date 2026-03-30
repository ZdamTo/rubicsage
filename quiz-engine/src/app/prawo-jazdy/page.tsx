export const metadata = {
  title: "Prawo Jazdy — ZdamTo.io",
  description: "Przygotowanie do egzaminu teoretycznego na prawo jazdy — wkrótce.",
};

export default function PrawoJazdyPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-6xl mb-4">🚗</div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Prawo Jazdy</h1>
      <p className="text-gray-500 text-lg mb-6 max-w-md">
        Moduł do nauki teorii prawa jazdy jest w przygotowaniu. Wkrótce pojawią się tu pytania
        testowe, znaki drogowe i symulacje egzaminu.
      </p>
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-4 max-w-sm">
        <p className="text-blue-800 font-medium text-sm">Planowane funkcje</p>
        <ul className="mt-2 text-sm text-blue-700 space-y-1 text-left list-disc list-inside">
          <li>Baza pytań z egzaminu WORD</li>
          <li>Znaki drogowe z objaśnieniami</li>
          <li>Symulacje testów w czasie rzeczywistym</li>
          <li>Statystyki i postępy nauki</li>
          <li>Tryb powtórek słabych partii</li>
        </ul>
      </div>
    </div>
  );
}
