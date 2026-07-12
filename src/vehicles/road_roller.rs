use super::super::*;

pub(crate) fn spawn_road_roller(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    let roller_yellow = unlit_material(materials, Color::srgb(1.0, 0.70, 0.05));
    let roller_dark = unlit_material(materials, Color::srgb(0.78, 0.42, 0.02));
    let drum = unlit_material(materials, Color::srgb(0.52, 0.58, 0.62));
    let tire = unlit_material(materials, Color::srgb(0.08, 0.09, 0.10));
    let window = unlit_material(materials, Color::srgb(0.28, 0.72, 0.84));
    let repaired_asphalt = unlit_material(materials, Color::srgb(0.26, 0.28, 0.31));
    let transparent_hitbox = materials.add(StandardMaterial {
        base_color: Color::srgba(1.0, 0.78, 0.10, 0.0),
        alpha_mode: AlphaMode::Blend,
        unlit: true,
        ..default()
    });

    let roller = commands
        .spawn((
            RoadRollerVehicle,
            Pickable::default(),
            Mesh3d(meshes.add(Cuboid::new(3.8, 2.7, 2.5))),
            MeshMaterial3d(transparent_hitbox),
            Transform::from_xyz(ROAD_ROLLER_START_X, ROAD_ROLLER_HOME_Y, 0.0),
            Visibility::Hidden,
        ))
        .observe(on_road_roller_drag_start)
        .observe(on_road_roller_drag)
        .observe(on_road_roller_drag_end)
        .observe(on_road_roller_pointer_cancel)
        .id();

    commands.entity(roller).with_children(|parent| {
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(2.55, 0.58, 1.55))),
            MeshMaterial3d(roller_dark.clone()),
            Transform::from_xyz(-0.20, -0.22, 0.0),
        ));
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(1.25, 1.25, 1.45))),
            MeshMaterial3d(roller_yellow.clone()),
            Transform::from_xyz(-0.55, 0.48, 0.0),
        ));
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(0.90, 0.64, 0.05))),
            MeshMaterial3d(window),
            Transform::from_xyz(-0.38, 0.58, 0.75),
        ));
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(1.60, 0.20, 1.65))),
            MeshMaterial3d(roller_yellow.clone()),
            Transform::from_xyz(-0.55, 1.18, 0.0),
        ));
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(1.20, 0.24, 1.45))),
            MeshMaterial3d(roller_yellow.clone()),
            Transform::from_xyz(0.62, -0.08, 0.0).with_rotation(Quat::from_rotation_z(-0.22)),
        ));

        let cylinder_rotation = Quat::from_rotation_x(std::f32::consts::FRAC_PI_2);
        parent.spawn((
            Mesh3d(meshes.add(Cylinder::new(0.72, 1.85).mesh().resolution(16))),
            MeshMaterial3d(drum),
            Transform::from_xyz(1.20, -0.26, 0.0).with_rotation(cylinder_rotation),
        ));
        let wheel_mesh = meshes.add(Cylinder::new(0.55, 0.30).mesh().resolution(14));
        for z in [-0.88, 0.88] {
            parent.spawn((
                Mesh3d(wheel_mesh.clone()),
                MeshMaterial3d(tire.clone()),
                Transform::from_xyz(-1.10, -0.58, z).with_rotation(cylinder_rotation),
            ));
        }
    });

    commands.spawn((
        RepairedRoad,
        Mesh3d(meshes.add(Cylinder::new(2.60, 0.08).mesh().resolution(16))),
        MeshMaterial3d(repaired_asphalt),
        Transform::from_xyz(2.25, 0.18, 0.0).with_scale(Vec3::new(0.05, 1.0, 1.0)),
        Visibility::Hidden,
    ));
}

pub(crate) fn on_road_roller_drag_start(
    event: On<Pointer<DragStart>>,
    camera: Single<(&Camera, &GlobalTransform), With<MeshPickingCamera>>,
    mission: Res<Mission>,
    mut stage: ResMut<RoadRollerStage>,
    roller: Single<&Transform, With<RoadRollerVehicle>>,
) {
    if event.button != PointerButton::Primary
        || mission.phase != MissionPhase::RoadRoller
        || stage.action != RoadRollerAction::Ready
    {
        return;
    }

    let (camera, camera_transform) = *camera;
    let Some(pointer_position) = pointer_on_horizontal_plane(
        event.pointer_location.position,
        camera,
        camera_transform,
        ROAD_ROLLER_HOME_Y,
    ) else {
        return;
    };
    stage.drag_offset_x = roller.translation.x - pointer_position.x;
    stage.action = RoadRollerAction::Dragging;
    info!("Road roller drag started");
}

pub(crate) fn on_road_roller_drag(
    event: On<Pointer<Drag>>,
    camera: Single<(&Camera, &GlobalTransform), With<MeshPickingCamera>>,
    mission: Res<Mission>,
    mut stage: ResMut<RoadRollerStage>,
    mut roller: Single<&mut Transform, With<RoadRollerVehicle>>,
) {
    if event.button != PointerButton::Primary
        || mission.phase != MissionPhase::RoadRoller
        || stage.action != RoadRollerAction::Dragging
    {
        return;
    }

    let (camera, camera_transform) = *camera;
    let Some(pointer_position) = pointer_on_horizontal_plane(
        event.pointer_location.position,
        camera,
        camera_transform,
        ROAD_ROLLER_HOME_Y,
    ) else {
        return;
    };
    roller.translation.x =
        (pointer_position.x + stage.drag_offset_x).clamp(ROAD_ROLLER_LEFT_X, ROAD_ROLLER_RIGHT_X);

    if stage.passes == 0 && roller.translation.x >= ROAD_ROLLER_RIGHT_X - 0.05 {
        roller.translation.x = ROAD_ROLLER_RIGHT_X;
        stage.passes = 1;
        stage.action = RoadRollerAction::SettlingFirstPass;
        stage.animation_elapsed = 0.0;
        info!("Road roller completed pass 1 of 2");
    } else if stage.passes == 1 && roller.translation.x <= ROAD_ROLLER_LEFT_X + 0.05 {
        roller.translation.x = ROAD_ROLLER_LEFT_X;
        stage.passes = 2;
        stage.action = RoadRollerAction::Flattening;
        stage.animation_elapsed = 0.0;
        info!("Road roller completed pass 2 of 2");
    }
}

pub(crate) fn on_road_roller_drag_end(
    event: On<Pointer<DragEnd>>,
    mut stage: ResMut<RoadRollerStage>,
) {
    if event.button == PointerButton::Primary && stage.action == RoadRollerAction::Dragging {
        stage.action = RoadRollerAction::Ready;
        info!("Road roller paused; ready to continue");
    }
}

pub(crate) fn on_road_roller_pointer_cancel(
    _: On<Pointer<Cancel>>,
    mut stage: ResMut<RoadRollerStage>,
) {
    if stage.action == RoadRollerAction::Dragging {
        stage.action = RoadRollerAction::Ready;
        info!("Road roller pointer canceled; ready to continue");
    }
}

pub(crate) fn advance_to_road_roller(
    time: Res<Time>,
    dump_truck_stage: Res<DumpTruckStage>,
    mut mission: ResMut<Mission>,
    mut road_roller_stage: ResMut<RoadRollerStage>,
    mut truck_visibility: Single<&mut Visibility, TruckToRollerFilter>,
    mut roller_visibility: Single<&mut Visibility, RollerTransitionFilter>,
    mut completion_visibility: Single<&mut Visibility, RollerCompletionTransitionFilter>,
) {
    if mission.phase != MissionPhase::DumpTruck
        || dump_truck_stage.action != DumpBedAction::Complete
    {
        return;
    }

    mission.transition_elapsed += time.delta_secs();
    if mission.transition_elapsed < 0.85 {
        return;
    }

    **truck_visibility = Visibility::Hidden;
    **completion_visibility = Visibility::Hidden;
    **roller_visibility = Visibility::Visible;
    mission.phase = MissionPhase::RoadRoller;
    mission.transition_elapsed = 0.0;
    road_roller_stage.action = RoadRollerAction::Entering;
    road_roller_stage.animation_elapsed = 0.0;
    road_roller_stage.passes = 0;
    info!("Road roller stage started");
}

pub(crate) fn animate_road_roller(
    time: Res<Time>,
    mut commands: Commands,
    mission: Res<Mission>,
    mut stage: ResMut<RoadRollerStage>,
    mut visuals: RoadRollerVisuals,
    pit_hole: Query<Entity, With<PitHole>>,
) {
    if mission.phase != MissionPhase::RoadRoller {
        return;
    }

    match stage.action {
        RoadRollerAction::Entering => {
            stage.animation_elapsed += time.delta_secs();
            let t = (stage.animation_elapsed / 1.15).clamp(0.0, 1.0);
            let eased = 1.0 - (1.0 - t) * (1.0 - t);
            visuals.roller.translation.x =
                ROAD_ROLLER_START_X + (ROAD_ROLLER_LEFT_X - ROAD_ROLLER_START_X) * eased;
            if t >= 1.0 {
                visuals.roller.translation.x = ROAD_ROLLER_LEFT_X;
                stage.action = RoadRollerAction::Ready;
                stage.animation_elapsed = 0.0;
                info!("Road roller parked; pass 1 ready");
            }
        }
        RoadRollerAction::SettlingFirstPass => {
            stage.animation_elapsed += time.delta_secs();
            let t = (stage.animation_elapsed / 0.42).clamp(0.0, 1.0);
            let eased = t * t * (3.0 - 2.0 * t);
            let (fill, fill_transform, _, fill_material) = &mut *visuals.pit_fill;
            fill_transform.scale.y = 1.0 - eased * 0.45;
            fill_material.0 = fill.compacted_material.clone();

            if t >= 1.0 {
                stage.action = RoadRollerAction::Ready;
                stage.animation_elapsed = 0.0;
                info!("Road fill partially compacted; pass 2 ready");
            }
        }
        RoadRollerAction::Flattening => {
            stage.animation_elapsed += time.delta_secs();
            let t = (stage.animation_elapsed / 0.78).clamp(0.0, 1.0);
            let eased = t * t * (3.0 - 2.0 * t);

            let (_, fill_transform, fill_visibility, _) = &mut *visuals.pit_fill;
            fill_transform.scale.y = 0.55 - eased * 0.47;
            let (road_transform, road_visibility) = &mut *visuals.repaired_road;
            **road_visibility = Visibility::Visible;
            road_transform.scale = Vec3::new(eased.max(0.05), 1.0, 1.0);

            if t >= 1.0 {
                **fill_visibility = Visibility::Hidden;
                for entity in &pit_hole {
                    commands.entity(entity).insert(Visibility::Hidden);
                }
                road_transform.scale = Vec3::ONE;
                stage.action = RoadRollerAction::Complete;
                stage.animation_elapsed = 0.0;
                **visuals.completion_visibility = Visibility::Visible;
                info!("Road roller stage complete");
            }
        }
        RoadRollerAction::Waiting
        | RoadRollerAction::Ready
        | RoadRollerAction::Dragging
        | RoadRollerAction::Complete => {}
    }
}

pub(crate) fn pulse_road_roller(
    time: Res<Time>,
    mission: Res<Mission>,
    stage: Res<RoadRollerStage>,
    mut roller: Single<&mut Transform, With<RoadRollerVehicle>>,
) {
    roller.scale = Vec3::ONE;
    if mission.phase == MissionPhase::RoadRoller && stage.action == RoadRollerAction::Ready {
        let bounce = ((time.elapsed_secs() * 5.0).sin() * 0.5 + 0.5) * 0.10;
        roller.translation.y = ROAD_ROLLER_HOME_Y + bounce;
    } else {
        roller.translation.y = ROAD_ROLLER_HOME_Y;
    }
}

pub(crate) fn reset_road_roller(
    restart: Res<RestartRequest>,
    mut commands: Commands,
    roller_entity: Single<Entity, With<RoadRollerVehicle>>,
    pit_holes: Query<Entity, With<PitHole>>,
    mut visuals: RoadRollerVisuals,
) {
    if !restart.0 {
        return;
    }

    commands.entity(*roller_entity).insert(Visibility::Hidden);
    **visuals.roller = Transform::from_xyz(ROAD_ROLLER_START_X, ROAD_ROLLER_HOME_Y, 0.0);
    for entity in &pit_holes {
        commands.entity(entity).insert(Visibility::Visible);
    }

    let (fill, fill_transform, fill_visibility, fill_material) = &mut *visuals.pit_fill;
    **fill_transform = Transform::from_xyz(2.25, 0.39, 0.0).with_scale(Vec3::new(0.05, 1.0, 0.05));
    **fill_visibility = Visibility::Hidden;
    fill_material.0 = fill.loose_material.clone();

    let (road_transform, road_visibility) = &mut *visuals.repaired_road;
    **road_transform = Transform::from_xyz(2.25, 0.18, 0.0).with_scale(Vec3::new(0.05, 1.0, 1.0));
    **road_visibility = Visibility::Hidden;
    **visuals.completion_visibility = Visibility::Hidden;
}
