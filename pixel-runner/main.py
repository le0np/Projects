"""Pixel Runner - a small endless runner made with Pygame.

Controls: SPACE (or click the player) to jump. Dodge snails and flies.
"""
import sys
from pathlib import Path
from random import choice, randint

import pygame

BASE = Path(__file__).resolve().parent
WIDTH, HEIGHT = 800, 400
GROUND_Y = 300
FPS = 60
JUMP_SPEED = -20
TEXT_COLOR = (64, 64, 64)
MENU_COLOR = (111, 196, 169)
MENU_BG = (94, 129, 162)


def load_image(*parts, alpha=True):
    image = pygame.image.load(str(BASE.joinpath(*parts)))
    return image.convert_alpha() if alpha else image.convert()


class Player(pygame.sprite.Sprite):
    def __init__(self, jump_sound):
        super().__init__()
        self.walk_frames = [
            load_image("graphics", "player", "player_walk_1.png"),
            load_image("graphics", "player", "player_walk_2.png"),
        ]
        self.jump_frame = load_image("graphics", "player", "jump.png")
        self.jump_sound = jump_sound
        self.frame_index = 0.0
        self.image = self.walk_frames[0]
        self.rect = self.image.get_rect(midbottom=(80, GROUND_Y))
        self.gravity = 0

    def on_ground(self):
        return self.rect.bottom >= GROUND_Y

    def jump(self):
        if self.on_ground():
            self.gravity = JUMP_SPEED
            self.jump_sound.play()

    def reset(self):
        self.rect.midbottom = (80, GROUND_Y)
        self.gravity = 0

    def update(self):
        keys = pygame.key.get_pressed()
        if keys[pygame.K_SPACE]:
            self.jump()

        self.gravity += 1
        self.rect.y += self.gravity
        if self.rect.bottom >= GROUND_Y:
            self.rect.bottom = GROUND_Y
            self.gravity = 0

        if not self.on_ground():
            self.image = self.jump_frame
        else:
            self.frame_index = (self.frame_index + 0.1) % len(self.walk_frames)
            self.image = self.walk_frames[int(self.frame_index)]


class Obstacle(pygame.sprite.Sprite):
    def __init__(self, kind):
        super().__init__()
        if kind == "fly":
            names, y_pos = ("fly1.png", "fly2.png"), 210
            folder = "fly"
        else:
            names, y_pos = ("snail1.png", "snail2.png"), GROUND_Y
            folder = "snail"
        self.frames = [load_image("graphics", folder, n) for n in names]
        self.frame_index = 0.0
        self.image = self.frames[0]
        self.rect = self.image.get_rect(midbottom=(randint(900, 1100), y_pos))
        # Slightly smaller hitbox so near misses feel fair.
        self.hitbox = self.rect.inflate(-16, -10)

    def update(self, speed=6):
        self.frame_index = (self.frame_index + 0.1) % len(self.frames)
        self.image = self.frames[int(self.frame_index)]
        self.rect.x -= speed
        self.hitbox = self.image.get_rect(center=self.rect.center).inflate(-16, -10)
        if self.rect.right < -100:
            self.kill()


class Game:
    def __init__(self):
        pygame.mixer.pre_init(44100, -16, 2, 512)
        pygame.init()
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Pixel Runner")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(str(BASE / "font" / "Pixeltype.ttf"), 50)
        self.small_font = pygame.font.Font(str(BASE / "font" / "Pixeltype.ttf"), 30)

        self.sky = load_image("graphics", "Sky.png", alpha=False)
        self.ground = load_image("graphics", "ground.png", alpha=False)

        self.audio_ok = self._init_audio()
        self.player = Player(self.jump_sound)
        self.player_group = pygame.sprite.GroupSingle(self.player)
        self.obstacles = pygame.sprite.Group()

        stand = load_image("graphics", "player", "player_stand.png")
        self.stand = pygame.transform.rotozoom(stand, 0, 2)
        self.stand_rect = self.stand.get_rect(center=(400, 200))
        self.title = self.font.render("Pixel Runner", False, MENU_COLOR)
        self.title_rect = self.title.get_rect(center=(400, 70))
        self.hint = self.font.render("Press space to run", False, MENU_COLOR)
        self.hint_rect = self.hint.get_rect(center=(400, 320))

        self.obstacle_timer = pygame.USEREVENT + 1
        pygame.time.set_timer(self.obstacle_timer, 1500)

        self.active = False
        self.start_ticks = 0
        self.score = 0
        self.best = 0
        self.played = False

    def _init_audio(self):
        """Audio is optional: the game still runs on machines without a sound device."""
        class _Silent:
            def play(self, *a, **k):
                pass

        self.jump_sound = _Silent()
        try:
            self.jump_sound = pygame.mixer.Sound(str(BASE / "audio" / "jump.mp3"))
            self.jump_sound.set_volume(0.5)
            pygame.mixer.music.load(str(BASE / "audio" / "music.wav"))
            pygame.mixer.music.set_volume(0.3)
            pygame.mixer.music.play(loops=-1)
            return True
        except pygame.error:
            return False

    def start_run(self):
        self.active = True
        self.start_ticks = pygame.time.get_ticks()
        self.score = 0
        self.obstacles.empty()
        self.player.reset()

    def end_run(self):
        self.active = False
        self.played = True
        self.best = max(self.best, self.score)
        self.obstacles.empty()
        self.player.reset()

    def speed(self):
        # Gets a little faster every 10 points, capped.
        return min(6 + self.score // 10, 12)

    def spawn_obstacle(self):
        self.obstacles.add(Obstacle(choice(["fly", "snail", "snail"])))

    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False
            if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                return False
            if self.active:
                if event.type == self.obstacle_timer:
                    self.spawn_obstacle()
                elif event.type == pygame.MOUSEBUTTONDOWN:
                    if self.player.rect.collidepoint(event.pos):
                        self.player.jump()
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
                self.start_run()
        return True

    def draw_hud(self):
        surf = self.font.render(f"Score: {self.score}", False, TEXT_COLOR)
        self.screen.blit(surf, surf.get_rect(center=(400, 50)))

    def update_active(self):
        self.score = (pygame.time.get_ticks() - self.start_ticks) // 1000
        self.screen.blit(self.sky, (0, 0))
        self.screen.blit(self.ground, (0, GROUND_Y))
        self.draw_hud()

        self.player_group.update()
        self.player_group.draw(self.screen)
        self.obstacles.update(self.speed())
        self.obstacles.draw(self.screen)

        if any(self.player.rect.colliderect(o.hitbox) for o in self.obstacles):
            self.end_run()

    def draw_menu(self):
        self.screen.fill(MENU_BG)
        self.screen.blit(self.stand, self.stand_rect)
        self.screen.blit(self.title, self.title_rect)
        if not self.played:
            self.screen.blit(self.hint, self.hint_rect)
        else:
            msg = self.font.render(f"Your Score: {self.score}", False, MENU_COLOR)
            self.screen.blit(msg, msg.get_rect(center=(400, 330)))
            best = self.small_font.render(f"Best: {self.best}   (space to retry)", False, MENU_COLOR)
            self.screen.blit(best, best.get_rect(center=(400, 375)))

    def frame(self):
        """Run one frame. Returns False when the game should quit."""
        if not self.handle_events():
            return False
        if self.active:
            self.update_active()
        else:
            self.draw_menu()
        pygame.display.update()
        self.clock.tick(FPS)
        return True

    def run(self):
        while self.frame():
            pass
        pygame.quit()


def main():
    Game().run()


if __name__ == "__main__":
    main()
    sys.exit(0)
