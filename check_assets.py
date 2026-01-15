import os
import json

def check_project_structure():
    print("🔍 ЗАПУСК ПРОВЕРКИ ФАЙЛОВ...")
    
    # 1. Проверяем, где мы находимся
    current_dir = os.getcwd()
    print(f"📂 Текущая папка: {current_dir}")

    # 2. Ищем app.json
    if not os.path.exists("app.json"):
        print("❌ ОШИБКА: Файл app.json не найден! Вы запускаете скрипт не в корне проекта.")
        return

    # 3. Читаем настройки из app.json
    try:
        with open("app.json", "r", encoding="utf-8") as f:
            config = json.load(f)
            expo_config = config.get("expo", {})
            
            # Получаем пути к картинкам из конфига
            icon_path = expo_config.get("icon")
            splash_path = expo_config.get("splash", {}).get("image") or \
                          (expo_config.get("plugins", [])[0][1].get("image") if isinstance(expo_config.get("plugins", []), list) else None)
            
            print(f"📄 В app.json указана иконка: {icon_path}")
            
            # 4. Проверяем физическое наличие файла
            if icon_path:
                # Убираем ./ в начале, если есть
                clean_path = icon_path.replace("./", "").replace("/", os.sep)
                full_path = os.path.join(current_dir, clean_path)
                
                if os.path.exists(full_path):
                    print(f"✅ ФАЙЛ НАЙДЕН: {clean_path}")
                else:
                    print(f"❌ ОШИБКА: Файл НЕ НАЙДЕН по адресу: {full_path}")
                    print("👉 Совет: Проверьте, существует ли папка 'assets', а внутри неё 'images'.")
            else:
                print("⚠️ В app.json не найдена запись 'icon'.")

    except Exception as e:
        print(f"❌ Ошибка при чтении app.json: {e}")

    # 5. Выводим список файлов в assets/images для проверки
    images_dir = os.path.join(current_dir, "assets", "images")
    if os.path.exists(images_dir):
        print("\n📂 Содержимое папки assets/images:")
        for file in os.listdir(images_dir):
            print(f" - {file}")
    else:
        print("\n❌ Папка assets/images вообще отсутствует!")

if __name__ == "__main__":
    check_project_structure()