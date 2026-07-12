use bevy::camera::ScalingMode;
use bevy::core_pipeline::tonemapping::Tonemapping;
use bevy::prelude::*;

mod vehicles;
use vehicles::*;

const VIEWPORT_HEIGHT: f32 = 12.0;
const BUCKET_HOME: Vec3 = Vec3::new(-1.25, 0.85, 0.0);
const DRAG_PLANE_HEIGHT: f32 = 0.85;
const ROCK_COUNT: u8 = 3;
const CONTACT_RADIUS: f32 = 1.35;
const ARM_PIVOT: Vec3 = Vec3::new(-4.0, 2.35, 0.0);
const BUCKET_JOINT_OFFSET: Vec3 = Vec3::new(-0.25, 0.35, 0.0);
const BOOM_LENGTH: f32 = 3.6;
const STICK_LENGTH: f32 = 4.0;
const ARM_REACH_MARGIN: f32 = 0.04;
const BUCKET_FOLLOW_SPEED: f32 = 24.0;
const DUMP_TRUCK_START_X: f32 = -9.0;
const DUMP_TRUCK_PARKED_X: f32 = -1.3;
const DUMP_BED_HOME: Vec3 = Vec3::new(1.25, 1.60, 0.0);
const DUMP_BED_MAX_TILT: f32 = -0.92;
const ROAD_ROLLER_START_X: f32 = -9.0;
const ROAD_ROLLER_LEFT_X: f32 = -1.2;
const ROAD_ROLLER_RIGHT_X: f32 = 5.4;
const ROAD_ROLLER_HOME_Y: f32 = 1.2;
const PASSING_CAR_START_X: f32 = -9.0;
const PASSING_CAR_END_X: f32 = 9.0;

#[derive(Resource)]
struct Mission {
    phase: MissionPhase,
    transition_elapsed: f32,
}

impl Default for Mission {
    fn default() -> Self {
        Self {
            phase: MissionPhase::Excavator,
            transition_elapsed: 0.0,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum MissionPhase {
    Excavator,
    DumpTruck,
    RoadRoller,
    Traffic,
    Complete,
}

#[derive(Resource)]
struct ExcavatorStage {
    action: BucketAction,
    drag_offset: Vec3,
    drag_target: Vec3,
    cleared_rocks: u8,
    carried_rock: Option<Entity>,
    animation_elapsed: f32,
    scoop_start: Vec3,
}

impl Default for ExcavatorStage {
    fn default() -> Self {
        Self {
            action: BucketAction::Idle,
            drag_offset: Vec3::ZERO,
            drag_target: BUCKET_HOME,
            cleared_rocks: 0,
            carried_rock: None,
            animation_elapsed: 0.0,
            scoop_start: BUCKET_HOME,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum BucketAction {
    Idle,
    Dragging,
    Scooping,
    Returning,
    Complete,
}

#[derive(Resource)]
struct DumpTruckStage {
    action: DumpBedAction,
    animation_elapsed: f32,
    preview_tilt: f32,
}

impl Default for DumpTruckStage {
    fn default() -> Self {
        Self {
            action: DumpBedAction::Waiting,
            animation_elapsed: 0.0,
            preview_tilt: 0.0,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum DumpBedAction {
    Waiting,
    Entering,
    Ready,
    Dragging,
    Dumping,
    Returning,
    Complete,
}

#[derive(Resource)]
struct RoadRollerStage {
    action: RoadRollerAction,
    animation_elapsed: f32,
    passes: u8,
    drag_offset_x: f32,
}

impl Default for RoadRollerStage {
    fn default() -> Self {
        Self {
            action: RoadRollerAction::Waiting,
            animation_elapsed: 0.0,
            passes: 0,
            drag_offset_x: 0.0,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum RoadRollerAction {
    Waiting,
    Entering,
    Ready,
    Dragging,
    SettlingFirstPass,
    Flattening,
    Complete,
}

#[derive(Resource)]
struct CompletionStage {
    action: CompletionAction,
    animation_elapsed: f32,
}

impl Default for CompletionStage {
    fn default() -> Self {
        Self {
            action: CompletionAction::Waiting,
            animation_elapsed: 0.0,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum CompletionAction {
    Waiting,
    ClearingRoad,
    Driving,
    Celebrating,
    Complete,
}

#[derive(Resource, Default)]
struct RestartRequest(bool);

#[derive(Component)]
struct DraggableBucket;

#[derive(Component)]
struct ExcavatorVisual;

#[derive(Component)]
struct Rock {
    order: u8,
    rotation: Quat,
}

#[derive(Component)]
struct TargetHalo {
    order: u8,
}

#[derive(Component)]
struct ArmSegment {
    part: ArmPart,
}

#[derive(Clone, Copy)]
enum ArmPart {
    Boom,
    Stick,
}

#[derive(Component)]
struct CompletionFeedback;

#[derive(Component)]
struct DumpTruckVehicle;

#[derive(Component)]
struct DumpBed;

#[derive(Component)]
struct PitHole;

#[derive(Component)]
struct PitFill {
    loose_material: Handle<StandardMaterial>,
    compacted_material: Handle<StandardMaterial>,
}

#[derive(Component)]
struct GravelStream {
    offset: f32,
}

#[derive(Component)]
struct RoadRollerVehicle;

#[derive(Component)]
struct RepairedRoad;

#[derive(Component)]
struct RoadBarrier {
    home: Vec3,
    cleared_z: f32,
}

#[derive(Component)]
struct PassingCar;

#[derive(Component)]
struct HornFeedback;

#[derive(Component)]
struct CelebrationSpark {
    angle: f32,
}

#[derive(Component)]
struct RestartButton;

type TruckTransformFilter = (
    With<DumpTruckVehicle>,
    Without<DumpBed>,
    Without<PitFill>,
    Without<GravelStream>,
);
type BedTransformFilter = (
    With<DumpBed>,
    Without<DumpTruckVehicle>,
    Without<PitFill>,
    Without<GravelStream>,
);
type PitFillFilter = (
    With<PitFill>,
    Without<DumpTruckVehicle>,
    Without<DumpBed>,
    Without<GravelStream>,
);
type GravelFilter = (
    Without<DumpTruckVehicle>,
    Without<DumpBed>,
    Without<PitFill>,
    Without<CompletionFeedback>,
);
type CompletionFilter = (
    With<CompletionFeedback>,
    Without<DumpTruckVehicle>,
    Without<DumpBed>,
    Without<PitFill>,
    Without<GravelStream>,
);
type TruckTransitionFilter = (
    With<DumpTruckVehicle>,
    Without<ExcavatorVisual>,
    Without<CompletionFeedback>,
);
type CompletionTransitionFilter = (
    With<CompletionFeedback>,
    Without<ExcavatorVisual>,
    Without<DumpTruckVehicle>,
);
type GravelQueryData = (
    &'static GravelStream,
    &'static mut Transform,
    &'static mut Visibility,
);

#[derive(bevy::ecs::system::SystemParam)]
struct DumpTruckVisuals<'w, 's> {
    truck: Single<'w, 's, &'static mut Transform, TruckTransformFilter>,
    bed: Single<'w, 's, &'static mut Transform, BedTransformFilter>,
    pit_fill: Single<'w, 's, (&'static mut Transform, &'static mut Visibility), PitFillFilter>,
    gravel: Query<'w, 's, GravelQueryData, GravelFilter>,
    completion_visibility: Single<'w, 's, &'static mut Visibility, CompletionFilter>,
}

type RollerTransformFilter = (
    With<RoadRollerVehicle>,
    Without<PitFill>,
    Without<RepairedRoad>,
    Without<CompletionFeedback>,
);
type RollerPitFillFilter = (
    With<PitFill>,
    Without<RoadRollerVehicle>,
    Without<RepairedRoad>,
    Without<CompletionFeedback>,
);
type RepairedRoadFilter = (
    With<RepairedRoad>,
    Without<RoadRollerVehicle>,
    Without<PitFill>,
    Without<CompletionFeedback>,
);
type RollerCompletionFilter = (
    With<CompletionFeedback>,
    Without<RoadRollerVehicle>,
    Without<PitFill>,
    Without<RepairedRoad>,
);
type TruckToRollerFilter = (
    With<DumpTruckVehicle>,
    Without<RoadRollerVehicle>,
    Without<CompletionFeedback>,
);
type RollerTransitionFilter = (
    With<RoadRollerVehicle>,
    Without<DumpTruckVehicle>,
    Without<CompletionFeedback>,
);
type RollerCompletionTransitionFilter = (
    With<CompletionFeedback>,
    Without<DumpTruckVehicle>,
    Without<RoadRollerVehicle>,
);
type RollerPitFillData = (
    &'static PitFill,
    &'static mut Transform,
    &'static mut Visibility,
    &'static mut MeshMaterial3d<StandardMaterial>,
);

#[derive(bevy::ecs::system::SystemParam)]
struct RoadRollerVisuals<'w, 's> {
    roller: Single<'w, 's, &'static mut Transform, RollerTransformFilter>,
    pit_fill: Single<'w, 's, RollerPitFillData, RollerPitFillFilter>,
    repaired_road:
        Single<'w, 's, (&'static mut Transform, &'static mut Visibility), RepairedRoadFilter>,
    completion_visibility: Single<'w, 's, &'static mut Visibility, RollerCompletionFilter>,
}

type CompletionSequenceData = (
    &'static mut Transform,
    &'static mut Visibility,
    Option<&'static RoadBarrier>,
    Has<PassingCar>,
    Has<HornFeedback>,
    Option<&'static CelebrationSpark>,
    Has<RestartButton>,
    Has<CompletionFeedback>,
);
type CompletionSequenceFilter = Or<(
    With<RoadBarrier>,
    With<PassingCar>,
    With<HornFeedback>,
    With<CelebrationSpark>,
    With<RestartButton>,
    With<CompletionFeedback>,
)>;
type RollerToTrafficFilter = (With<RoadRollerVehicle>, Without<CompletionFeedback>);
type TrafficCompletionFilter = (With<CompletionFeedback>, Without<RoadRollerVehicle>);

#[derive(bevy::ecs::system::SystemParam)]
struct CompletionSequenceVisuals<'w, 's> {
    all: Query<'w, 's, CompletionSequenceData, CompletionSequenceFilter>,
}

type ResetExcavatorFilter = (With<ExcavatorVisual>, Without<Rock>, Without<TargetHalo>);
type ResetRockFilter = (With<Rock>, Without<ExcavatorVisual>, Without<TargetHalo>);
type ResetHaloFilter = (With<TargetHalo>, Without<ExcavatorVisual>, Without<Rock>);

#[derive(Resource)]
struct ExcavatorMaterials {
    rock_idle: Handle<StandardMaterial>,
    rock_active: Handle<StandardMaterial>,
}

fn main() {
    App::new()
        .add_plugins((DefaultPlugins, MeshPickingPlugin))
        .insert_resource(MeshPickingSettings {
            require_markers: true,
            ..default()
        })
        .insert_resource(ClearColor(Color::srgb(0.53, 0.81, 0.92)))
        .init_resource::<Mission>()
        .init_resource::<ExcavatorStage>()
        .init_resource::<DumpTruckStage>()
        .init_resource::<RoadRollerStage>()
        .init_resource::<CompletionStage>()
        .init_resource::<RestartRequest>()
        .add_systems(Startup, setup_scene)
        .add_systems(
            Update,
            (
                follow_bucket_drag,
                detect_bucket_contact,
                animate_scoop_and_return,
                update_arm,
                pulse_active_target,
                advance_to_dump_truck,
                animate_dump_truck,
                pulse_dump_bed,
                advance_to_road_roller,
                animate_road_roller,
                pulse_road_roller,
                advance_to_traffic,
                animate_completion_sequence,
                animate_completion_feedback,
                reset_excavator,
                reset_dump_truck,
                reset_road_roller,
                reset_completion_sequence,
                reset_resources,
            )
                .chain(),
        )
        .run();
}

fn unlit_material(
    materials: &mut Assets<StandardMaterial>,
    color: Color,
) -> Handle<StandardMaterial> {
    materials.add(StandardMaterial {
        base_color: color,
        unlit: true,
        ..default()
    })
}

fn setup_scene(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    asset_server: Res<AssetServer>,
) {
    commands.spawn((
        Camera3d::default(),
        MeshPickingCamera,
        Tonemapping::None,
        Projection::from(OrthographicProjection {
            scaling_mode: ScalingMode::FixedVertical {
                viewport_height: VIEWPORT_HEIGHT,
            },
            ..OrthographicProjection::default_3d()
        }),
        Transform::from_xyz(10.0, 10.0, 14.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));

    commands.spawn((
        DirectionalLight {
            illuminance: 8_000.0,
            shadow_maps_enabled: false,
            ..default()
        },
        Transform::from_xyz(6.0, 10.0, 8.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));

    let grass = unlit_material(&mut materials, Color::srgb(0.32, 0.58, 0.30));
    let asphalt = unlit_material(&mut materials, Color::srgb(0.22, 0.24, 0.27));
    let road_yellow = unlit_material(&mut materials, Color::srgb(1.0, 0.82, 0.18));
    let pit_soil = unlit_material(&mut materials, Color::srgb(0.19, 0.12, 0.08));
    let pit_edge = unlit_material(&mut materials, Color::srgb(0.42, 0.25, 0.12));

    commands.spawn((
        Mesh3d(meshes.add(Cuboid::new(20.0, 0.2, 12.0))),
        MeshMaterial3d(grass),
        Transform::from_xyz(0.0, -0.2, 0.0),
    ));
    commands.spawn((
        Mesh3d(meshes.add(Cuboid::new(16.0, 0.25, 4.5))),
        MeshMaterial3d(asphalt),
        Transform::from_xyz(0.0, 0.0, 0.0),
    ));

    let marking_mesh = meshes.add(Cuboid::new(1.7, 0.04, 0.18));
    for x in [-6.0, -3.5, 5.7] {
        commands.spawn((
            Mesh3d(marking_mesh.clone()),
            MeshMaterial3d(road_yellow.clone()),
            Transform::from_xyz(x, 0.15, 0.0),
        ));
    }

    commands.spawn((
        PitHole,
        Mesh3d(meshes.add(Cylinder::new(2.55, 0.10).mesh().resolution(16))),
        MeshMaterial3d(pit_edge),
        Transform::from_xyz(2.25, 0.17, 0.0),
    ));
    commands.spawn((
        PitHole,
        Mesh3d(meshes.add(Cylinder::new(2.2, 0.12).mesh().resolution(16))),
        MeshMaterial3d(pit_soil),
        Transform::from_xyz(2.25, 0.24, 0.0),
    ));

    spawn_excavator(&mut commands, &mut meshes, &mut materials);
    spawn_rocks(&mut commands, &mut meshes, &mut materials);
    spawn_dump_truck(&mut commands, &mut meshes, &mut materials);
    spawn_pit_fill(&mut commands, &mut meshes, &mut materials);
    spawn_road_roller(&mut commands, &mut meshes, &mut materials);
    spawn_completion_sequence(&mut commands, &mut meshes, &mut materials, &asset_server);
    spawn_completion_feedback(&mut commands, &mut meshes, &mut materials);
}

fn spawn_completion_sequence(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
    asset_server: &AssetServer,
) {
    let barrier_orange = unlit_material(materials, Color::srgb(1.0, 0.38, 0.03));
    let barrier_white = unlit_material(materials, Color::srgb(0.96, 0.94, 0.86));
    let car_red = unlit_material(materials, Color::srgb(0.90, 0.08, 0.08));
    let car_window = unlit_material(materials, Color::srgb(0.35, 0.75, 0.88));
    let tire = unlit_material(materials, Color::srgb(0.07, 0.08, 0.09));
    let horn_yellow = unlit_material(materials, Color::srgb(1.0, 0.84, 0.10));
    let restart_blue = unlit_material(materials, Color::srgb(0.05, 0.60, 0.92));
    let restart_icon = materials.add(StandardMaterial {
        base_color_texture: Some(asset_server.load("restart-icon.png")),
        alpha_mode: AlphaMode::Blend,
        unlit: true,
        ..default()
    });

    for (home, cleared_z) in [
        (Vec3::new(6.25, 0.45, -1.20), -4.6),
        (Vec3::new(6.25, 0.45, 1.20), 4.6),
    ] {
        let barrier = commands
            .spawn((
                RoadBarrier { home, cleared_z },
                Transform::from_translation(home),
                Visibility::Visible,
            ))
            .id();
        commands.entity(barrier).with_children(|parent| {
            for x in [-0.85, 0.85] {
                parent.spawn((
                    Mesh3d(meshes.add(Cuboid::new(0.20, 1.10, 0.20))),
                    MeshMaterial3d(barrier_orange.clone()),
                    Transform::from_xyz(x, 0.35, 0.0),
                ));
                parent.spawn((
                    Mesh3d(meshes.add(Cuboid::new(0.65, 0.14, 0.34))),
                    MeshMaterial3d(barrier_orange.clone()),
                    Transform::from_xyz(x, -0.24, 0.0),
                ));
            }
            parent.spawn((
                Mesh3d(meshes.add(Cuboid::new(2.15, 0.40, 0.22))),
                MeshMaterial3d(barrier_white.clone()),
                Transform::from_xyz(0.0, 0.48, 0.0),
            ));
            for x in [-0.60, 0.0, 0.60] {
                parent.spawn((
                    Mesh3d(meshes.add(Cuboid::new(0.28, 0.42, 0.24))),
                    MeshMaterial3d(barrier_orange.clone()),
                    Transform::from_xyz(x, 0.48, 0.0).with_rotation(Quat::from_rotation_z(-0.45)),
                ));
            }
        });
    }

    let car = commands
        .spawn((
            PassingCar,
            Transform::from_xyz(PASSING_CAR_START_X, 0.72, 0.0),
            Visibility::Hidden,
        ))
        .id();
    commands.entity(car).with_children(|parent| {
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(2.65, 0.55, 1.35))),
            MeshMaterial3d(car_red.clone()),
        ));
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(1.25, 0.70, 1.20))),
            MeshMaterial3d(car_red.clone()),
            Transform::from_xyz(-0.25, 0.56, 0.0),
        ));
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(0.72, 0.48, 0.05))),
            MeshMaterial3d(car_window),
            Transform::from_xyz(0.02, 0.58, 0.63),
        ));
        let wheel_mesh = meshes.add(Cylinder::new(0.34, 0.22).mesh().resolution(14));
        for x in [-0.85, 0.85] {
            for z in [-0.73, 0.73] {
                parent.spawn((
                    Mesh3d(wheel_mesh.clone()),
                    MeshMaterial3d(tire.clone()),
                    Transform::from_xyz(x, -0.25, z)
                        .with_rotation(Quat::from_rotation_x(std::f32::consts::FRAC_PI_2)),
                ));
            }
        }
    });

    let horn = commands
        .spawn((HornFeedback, Transform::default(), Visibility::Hidden))
        .id();
    commands.entity(horn).with_children(|parent| {
        for (x, scale) in [(0.0, 1.0), (0.45, 1.35), (0.92, 1.70)] {
            parent.spawn((
                Mesh3d(meshes.add(Cuboid::new(0.12, 0.70, 0.16))),
                MeshMaterial3d(horn_yellow.clone()),
                Transform::from_xyz(x, 0.0, 0.0)
                    .with_scale(Vec3::new(1.0, scale, 1.0))
                    .with_rotation(Quat::from_rotation_z(-0.18)),
            ));
        }
    });

    let spark_mesh = meshes.add(Cuboid::new(0.18, 0.70, 0.18));
    for index in 0..10 {
        let angle = index as f32 / 10.0 * std::f32::consts::TAU;
        commands.spawn((
            CelebrationSpark { angle },
            Mesh3d(spark_mesh.clone()),
            MeshMaterial3d(horn_yellow.clone()),
            Transform::from_xyz(2.25, 1.1, 0.0),
            Visibility::Hidden,
        ));
    }

    let transparent_hitbox = materials.add(StandardMaterial {
        base_color: Color::srgba(0.1, 0.75, 1.0, 0.0),
        alpha_mode: AlphaMode::Blend,
        unlit: true,
        ..default()
    });
    let restart = commands
        .spawn((
            RestartButton,
            Pickable::default(),
            Mesh3d(meshes.add(Cylinder::new(1.45, 0.35).mesh().resolution(20))),
            MeshMaterial3d(transparent_hitbox),
            Transform::from_xyz(6.25, 0.55, -3.35),
            Visibility::Hidden,
        ))
        .observe(on_restart_clicked)
        .id();
    commands.entity(restart).with_children(|parent| {
        parent.spawn((
            Mesh3d(meshes.add(Cylinder::new(1.02, 0.18).mesh().resolution(20))),
            MeshMaterial3d(restart_blue),
        ));
        parent.spawn((
            Mesh3d(meshes.add(Plane3d::default().mesh().size(1.55, 1.55))),
            MeshMaterial3d(restart_icon),
            Transform::from_xyz(0.0, 0.16, 0.0),
        ));
    });
}

fn spawn_completion_feedback(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    let green = unlit_material(materials, Color::srgb(0.16, 0.78, 0.32));
    let white = unlit_material(materials, Color::WHITE);
    let root = commands
        .spawn((
            CompletionFeedback,
            Transform::from_xyz(2.25, 0.55, 0.0),
            Visibility::Hidden,
        ))
        .id();

    commands.entity(root).with_children(|parent| {
        parent.spawn((
            Mesh3d(meshes.add(Cylinder::new(1.55, 0.16).mesh().resolution(20))),
            MeshMaterial3d(green),
        ));
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(0.75, 0.16, 0.28))),
            MeshMaterial3d(white.clone()),
            Transform::from_xyz(-0.42, 0.13, 0.08).with_rotation(Quat::from_rotation_y(-0.70)),
        ));
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(1.55, 0.16, 0.28))),
            MeshMaterial3d(white),
            Transform::from_xyz(0.34, 0.13, -0.16).with_rotation(Quat::from_rotation_y(0.70)),
        ));
    });
}

fn pointer_on_horizontal_plane(
    pointer_position: Vec2,
    camera: &Camera,
    camera_transform: &GlobalTransform,
    height: f32,
) -> Option<Vec3> {
    let ray = camera
        .viewport_to_world(camera_transform, pointer_position)
        .ok()?;
    ray.plane_intersection_point(Vec3::new(0.0, height, 0.0), InfinitePlane3d::new(Vec3::Y))
}

fn on_restart_clicked(
    event: On<Pointer<Click>>,
    mission: Res<Mission>,
    mut restart: ResMut<RestartRequest>,
) {
    if event.button == PointerButton::Primary && mission.phase == MissionPhase::Complete {
        restart.0 = true;
        info!("Mission restart requested");
    }
}

fn advance_to_traffic(
    time: Res<Time>,
    road_roller_stage: Res<RoadRollerStage>,
    mut mission: ResMut<Mission>,
    mut completion_stage: ResMut<CompletionStage>,
    mut roller_visibility: Single<&mut Visibility, RollerToTrafficFilter>,
    mut completion_visibility: Single<&mut Visibility, TrafficCompletionFilter>,
) {
    if mission.phase != MissionPhase::RoadRoller
        || road_roller_stage.action != RoadRollerAction::Complete
    {
        return;
    }

    mission.transition_elapsed += time.delta_secs();
    if mission.transition_elapsed < 0.85 {
        return;
    }

    **roller_visibility = Visibility::Hidden;
    **completion_visibility = Visibility::Hidden;
    mission.phase = MissionPhase::Traffic;
    mission.transition_elapsed = 0.0;
    completion_stage.action = CompletionAction::ClearingRoad;
    completion_stage.animation_elapsed = 0.0;
    info!("Traffic completion sequence started");
}

fn animate_completion_sequence(
    time: Res<Time>,
    mut mission: ResMut<Mission>,
    mut stage: ResMut<CompletionStage>,
    mut visuals: CompletionSequenceVisuals,
) {
    if !matches!(
        mission.phase,
        MissionPhase::Traffic | MissionPhase::Complete
    ) {
        return;
    }

    match stage.action {
        CompletionAction::ClearingRoad => {
            stage.animation_elapsed += time.delta_secs();
            let t = (stage.animation_elapsed / 0.85).clamp(0.0, 1.0);
            let eased = t * t * (3.0 - 2.0 * t);
            for (mut transform, _, barrier, _, _, _, _, _) in &mut visuals.all {
                if let Some(barrier) = barrier {
                    transform.translation = barrier.home;
                    transform.translation.z =
                        barrier.home.z + (barrier.cleared_z - barrier.home.z) * eased;
                }
            }
            if t >= 1.0 {
                stage.action = CompletionAction::Driving;
                stage.animation_elapsed = 0.0;
                info!("Road barriers cleared; passing car started");
            }
        }
        CompletionAction::Driving => {
            stage.animation_elapsed += time.delta_secs();
            let t = (stage.animation_elapsed / 2.45).clamp(0.0, 1.0);
            let eased = t * t * (3.0 - 2.0 * t);
            let car_x = PASSING_CAR_START_X + (PASSING_CAR_END_X - PASSING_CAR_START_X) * eased;
            let horn_visible = (0.42..=0.62).contains(&t);
            for (mut transform, mut visibility, _, is_car, is_horn, _, _, _) in &mut visuals.all {
                if is_car {
                    *visibility = Visibility::Visible;
                    transform.translation.x = car_x;
                    transform.translation.y = 0.72 + (time.elapsed_secs() * 10.0).sin() * 0.03;
                } else if is_horn {
                    *visibility = if horn_visible {
                        Visibility::Visible
                    } else {
                        Visibility::Hidden
                    };
                    transform.translation = Vec3::new(car_x + 1.75, 1.55, 0.0);
                    transform.scale =
                        Vec3::splat(1.0 + (time.elapsed_secs() * 12.0).sin().abs() * 0.18);
                }
            }
            if t >= 1.0 {
                stage.action = CompletionAction::Celebrating;
                stage.animation_elapsed = 0.0;
                info!("Passing car completed the route");
            }
        }
        CompletionAction::Celebrating => {
            stage.animation_elapsed += time.delta_secs();
            let t = (stage.animation_elapsed / 0.90).clamp(0.0, 1.0);
            for (
                mut transform,
                mut visibility,
                _,
                is_car,
                is_horn,
                spark,
                is_restart,
                is_completion,
            ) in &mut visuals.all
            {
                if is_car || is_horn {
                    *visibility = Visibility::Hidden;
                } else if let Some(spark) = spark {
                    *visibility = Visibility::Visible;
                    let direction = Vec3::new(spark.angle.cos(), 0.0, spark.angle.sin());
                    transform.translation = Vec3::new(2.25, 1.1, 0.0) + direction * (0.8 + t * 1.8);
                    transform.rotation = Quat::from_rotation_y(-spark.angle);
                    transform.scale = Vec3::splat(0.7 + t * 0.5);
                } else if is_restart {
                    *visibility = if t >= 0.55 {
                        Visibility::Visible
                    } else {
                        Visibility::Hidden
                    };
                } else if is_completion {
                    *visibility = Visibility::Visible;
                }
            }
            if t >= 1.0 {
                stage.action = CompletionAction::Complete;
                stage.animation_elapsed = 0.0;
                mission.phase = MissionPhase::Complete;
                info!("Mission complete; restart ready");
            }
        }
        CompletionAction::Complete => {
            for (mut transform, _, _, _, _, spark, is_restart, _) in &mut visuals.all {
                if let Some(spark) = spark {
                    let pulse = 1.0 + (time.elapsed_secs() * 4.0 + spark.angle).sin() * 0.16;
                    transform.scale = Vec3::splat(pulse);
                } else if is_restart {
                    let pulse = 1.0 + (time.elapsed_secs() * 4.5).sin() * 0.06;
                    transform.scale = Vec3::splat(pulse);
                }
            }
        }
        CompletionAction::Waiting => {}
    }
}

fn animate_completion_feedback(
    time: Res<Time>,
    mut feedback: Single<(&Visibility, &mut Transform), With<CompletionFeedback>>,
) {
    let (visibility, transform) = &mut *feedback;
    if **visibility == Visibility::Visible {
        let pulse = 1.0 + (time.elapsed_secs() * 4.0).sin() * 0.08;
        transform.scale = Vec3::splat(pulse);
        transform.rotation = Quat::from_rotation_y((time.elapsed_secs() * 1.5).sin() * 0.08);
    }
}

fn reset_completion_sequence(restart: Res<RestartRequest>, mut visuals: CompletionSequenceVisuals) {
    if !restart.0 {
        return;
    }

    for (
        mut transform,
        mut visibility,
        barrier,
        is_car,
        is_horn,
        spark,
        is_restart,
        is_completion,
    ) in &mut visuals.all
    {
        transform.rotation = Quat::IDENTITY;
        transform.scale = Vec3::ONE;
        if let Some(barrier) = barrier {
            transform.translation = barrier.home;
            *visibility = Visibility::Visible;
        } else if is_car {
            transform.translation = Vec3::new(PASSING_CAR_START_X, 0.72, 0.0);
            *visibility = Visibility::Hidden;
        } else if is_horn {
            *transform = Transform::default();
            *visibility = Visibility::Hidden;
        } else if spark.is_some() {
            transform.translation = Vec3::new(2.25, 1.1, 0.0);
            *visibility = Visibility::Hidden;
        } else if is_restart {
            transform.translation = Vec3::new(6.25, 0.55, -3.35);
            *visibility = Visibility::Hidden;
        } else if is_completion {
            transform.translation = Vec3::new(2.25, 0.55, 0.0);
            *visibility = Visibility::Hidden;
        }
    }
}

fn reset_resources(
    mut restart: ResMut<RestartRequest>,
    mut mission: ResMut<Mission>,
    mut excavator: ResMut<ExcavatorStage>,
    mut dump_truck: ResMut<DumpTruckStage>,
    mut road_roller: ResMut<RoadRollerStage>,
    mut completion: ResMut<CompletionStage>,
) {
    if !restart.0 {
        return;
    }

    *mission = Mission::default();
    *excavator = ExcavatorStage::default();
    *dump_truck = DumpTruckStage::default();
    *road_roller = RoadRollerStage::default();
    *completion = CompletionStage::default();
    restart.0 = false;
    info!("Mission restarted");
}
